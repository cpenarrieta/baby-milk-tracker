const Alexa = require('alexa-sdk')
const moment = require('moment-timezone')

const { mlToOz, ozToMl } = require('./conversions')
const { getUser, putUser } = require('./dynamoHelper')
const updateUserLocation = require('./updateUserLocation')
const { POSTAL_REQUIRED_ERROR } = require('./errorCodes')

const SKILL_ID = 'amzn1.ask.skill.2cb7cf3a-c642-4db2-b5d2-a27c0cb1f387'
const DELETE_DAYS_LIMIT = 20
const welcomeMessage = `Welcome to the Milky Baby skill, add your feeding baby milk amount to your account by saying for example: 
  'add 3 ounces'. This will save this data to your account and we we will provide you
  summarized information by saying: 'what's my status'.
  Thanks for using Milky Baby.`

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
          ctx.emit(':tell', `Please grant device location settings permissions to the skill in order to get your current time.`)
        } else {
          ctx.emit(':tell', `Error with Milky Baby skill, please try again`)
        }
      } else {
        ctx.emit(':ask', welcomeMessage, 'Please say that again?')
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
      this.emit(':tell', "Please indicate a correct number to add, for example: 'add 60 ounces.'")
    } else if (!unitMeasures.hasOwnProperty(unitStr)) {
      this.emit(':tell', "Invalid unit measure, we only support ounces or milliliters.")
    }
    
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
              ctx.emit(':tell', `Please grant device location settings permissions to the skill in order to get your current time.`)
            } else {
              ctx.emit(':tell', `Error with Milky Baby skill, please try again`)
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
        this.emit(':tell', `Your baby consumed about ${Math.round(total)} ${unit} today. The last feeding time was at ${lastFeefingTime}.`)
      })
    })
  },

  'AMAZON.HelpIntent': function () {
    this.emit(':ask', welcomeMessage, 'Please say that again?')
  },

  'AMAZON.CancelIntent': function () {
    this.emit(':tell', 'Thank you for trying the Milky Baby Skill. Have a nice day!')
  },

  'AMAZON.StopIntent': function () {
    this.emit(':tell', 'Thank you for trying the Milky Baby Skill. Have a nice day!')
  },

  'Unhandled': function () {
    this.emit(':ask', welcomeMessage, 'Please say that again?')
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
