const Alexa = require('alexa-sdk')
const moment = require('moment-timezone')

const { mlToOz, ozToMl } = require('./conversions')
const { getUser, putUser } = require('./dynamoHelper')
const updateUserLocation = require('./updateUserLocation')
const { POSTAL_REQUIRED_ERROR } = require('./errorCodes')
const {
  welcomeMessage,
  milkEmptyMessage,
  againMessage,
  grantDeviceLocationMessage,
  errorMilkyBabyMessage,
  invalidUnitMessage,
  incorrectNumberMessage,
  thankYouMessage
} = require('./messages')

const SKILL_ID = process.env.SKILL_ID
const DELETE_DAYS_LIMIT = 20

const unitMeasures = {
  ml: 'ml',
  "m.l.": 'ml',
  "m.l": 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  oz: 'oz',
  "o.z.": 'oz',
  "o.z": 'oz',
  ounce: 'oz',
  ounces: 'oz',
}

const handlers = {
  'LaunchRequest': function () {
    const ctx = this
    updateUserLocation.call(this, (err) => {
      if (err) {
        if (err === POSTAL_REQUIRED_ERROR) {
          ctx.emit(':tell', grantDeviceLocationMessage)
        } else {
          ctx.emit(':tell', errorMilkyBabyMessage)
        }
      } else {
        ctx.emit(':ask', welcomeMessage, againMessage)
      }
    })
  },

  'SubmitMilkIntent': function () {
    const ctx = this
    const userId = this.event.session.user.userId
    const { amount: amountStr, unit } = this.event.request.intent.slots
    const unitStr = unit.value && unit.value.replace(/(?!\w|\s)./g, '').toLowerCase()
    const amount = amountStr.value && parseInt(amountStr.value.replace(/(?!\w|\s)./g, ''), 10)
    
    if (isNaN(amount)) {
      this.emit(':tell', incorrectNumberMessage)
    } else if (!unitMeasures.hasOwnProperty(unitStr)) {
      this.emit(':tell', invalidUnitMessage)
    } else {
      const insertMilkRecord = (user) => {
        const unit = (unitMeasures[unitStr] || user.unit) || unitStr
        let milks = []
        if (user && user.milks) {
          milks = user.milks
        }
        
        const currDate = new moment()
        const date = currDate.tz(user.timeZoneId).format('YYYY-MM-DD HH:mm')
        milks.push({ amount, unit, date })
  
        const putParams = Object.assign({}, user, { userId, milks, unit })
        putUser(putParams, result => {
          ctx.emit(':tell', `${amount} ${unit} added.`)
        })
      }
  
      getUser(userId, user => {
        if (user === undefined || user === null || user.timeZoneId === undefined || user.timeZoneId === null) {
          updateUserLocation.call(this, (err) => {
            if (err) {
              if (err === POSTAL_REQUIRED_ERROR) {
                ctx.emit(':tell', grantDeviceLocationMessage)
              } else {
                ctx.emit(':tell', errorMilkyBabyMessage)
              }
            } else {
              getUser(userId, user => {
                insertMilkRecord(user)
              })
            }
          })
        } else {
          insertMilkRecord(user)
        }
      })
    }
  },

  'WhatsMyStatusIntent': function () {
    const userId = this.event.session.user.userId

    getUser(userId, user => {
      const date = new moment()
      const today = date.tz(user.timeZoneId)
      const unit = user.unit
      let lastFeefingTime = ''
      let total = 0
      const itemsToDelete = []

      if (!user.milks) {
        this.emit(':ask', milkEmptyMessage, againMessage)
      } else {
        user.milks.forEach((m, key) => {
          const dateItem = moment(m.date)
  
          if (today.day() === dateItem.day()) {
            if (m.unit === unit) {
              total += m.amount
            } else if (m.unit === 'ml' && unit === 'oz') {
              total += mlToOz(m.amount)
            } else if (m.unit === 'oz' && unit === 'ml') {
              total += ozToMl(m.amount)
            }
          }
  
          if (today.diff(dateItem, 'days') > DELETE_DAYS_LIMIT) {
            itemsToDelete.push(key)
          }
  
          if (user.milks.length - 1 === key) {
            lastFeefingTime = dateItem.format('h:mm A')
          }
        })
  
        removeOldItems(user, itemsToDelete,  () => {
          if (total <= 0 || !lastFeefingTime)
            this.emit(':ask', milkEmptyMessage, againMessage)
          else
            this.emit(':tell', `Your baby consumed about ${Math.round(total)} ${unit} today. The last feeding time was at ${lastFeefingTime}.`)
        })
      }
    })
  },

  'AMAZON.HelpIntent': function () {
    this.emit(':ask', welcomeMessage, againMessage)
  },

  'AMAZON.CancelIntent': function () {
    this.emit(':tell', thankYouMessage)
  },

  'AMAZON.StopIntent': function () {
    this.emit(':tell', thankYouMessage)
  },

  'Unhandled': function () {
    this.emit(':ask', welcomeMessage, againMessage)
  }
}

function removeOldItems(user, itemsToDelete, callback) {
  if (itemsToDelete.length === 0)
    callback()

  const putParams = user
  putParams.milks.splice(0, itemsToDelete.length)

  putUser(putParams, callback)
}

exports.handler = function(event, context, callback) {
  const alexa = Alexa.handler(event, context)
  alexa.appId = SKILL_ID
  alexa.registerHandlers(handlers)
  alexa.execute()
}
