const Alexa = require('alexa-sdk')
const moment = require('moment-timezone')
const https = require('https')
const axios = require('axios')
const { mlToOz, ozToMl } = require('./conversions')
const { readDynamoItem, putUser } = require('./dynamoHelper')

const SKILL_ID = 'amzn1.ask.skill.2cb7cf3a-c642-4db2-b5d2-a27c0cb1f387'
const DELETE_DAYS_LIMIT = 20

const unitMeasures = {
  ml: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
}

function updateUserLocation(callback) {
  const userId = this.event.session.user.userId
  const consentToken = this.event.session.user.permissions.consentToken
  const deviceId = this.event.context.System.device.deviceId
  let countryCode = ''
  let postalCode = ''
  let lat = 0
  let lng = 0
  let city = ''
  let state = ''
  let timeZoneId = ''

  axios.get(`https://api.amazonalexa.com/v1/devices/${deviceId}/settings/address/countryAndPostalCode`, {
    headers: { 'Authorization': `Bearer ${consentToken}` }
  })
  .then((response) => {
    countryCode = response.data.countryCode
    postalCode = response.data.postalCode
    return axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${countryCode},${postalCode}&key=${process.env.GOOGLE_MAPS_KEY}`)
  })
  .then((response) => {
    city = response.data.results[0].address_components[1].short_name
    state = response.data.results[0].address_components[3].short_name
    lat = response.data.results[0].geometry.location.lat
    lng = response.data.results[0].geometry.location.lng
    return axios.get(`https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${moment().unix()}&key=${process.env.GOOGLE_MAPS_KEY}`)
  })
  .then((response) => {
    timeZoneId = response.data.timeZoneId
    readDynamoItem(userId, user => {
      const putParams = Object.assign({}, user, { userId, countryCode, postalCode, city, state, timeZoneId, lat, lng })
      putUser(putParams, result => {
        callback(false)
      })
    })
  })
  .catch((err) => {
    console.error('ERROR during updateUserLocation', err)
    callback(true)
  })
}

const handlers = {
  'LaunchRequest': function () {
    const ctx = this
    updateUserLocation.call(this, (err) => {
      if (err) {
        ctx.emit(':tell', `Error with Milky Baby!`)
      } else {
        ctx.emit(':tell', `Welcome to the Milky Baby Skill, add your feeding baby milk amount to your account by saying for example: 
          'ask milky baby to add 60 oz'. This will save this data to your account and we we will provide you
          summarized information by saying: 'ask milky baby for a status'.
          Thanks for using Milky Baby.`)
      }
    })
  },

  'SubmitMilkIntent': function () {
    const ctx = this
    const userId = this.event.session.user.userId
    const { amount: amountStr, unit } = this.event.request.intent.slots
    const amount = parseInt(amountStr.value, 10)
    
    if (isNaN(amount))
      this.emit(':tell', "Please indicate a correct number to add, for example: 'ask milky baby to add 60 oz.'")
    
    if (!unitMeasures.hasOwnProperty(unit.value))
      this.emit(':tell', "Invalid unit measure, we only support ounces or milliliters.")
    
    const insertMilkRecord = (user) => {
      let milks = []
      if (user && user.milks) {
        milks = user.milks
      }
      
      const currDate = new moment()
      const date = currDate.tz(user.timeZoneId).format('YYYY-MM-DD HH:mm')
      milks.push({ amount, unit: unitMeasures[unit.value], date })

      const putParams = Object.assign({}, user, { userId, milks, unit: unitMeasures[unit.value] })
      putUser(putParams, result => {
        ctx.emit(':tell', `${amount} ${unitMeasures[unit.value]} added.`)
      })
    }

    readDynamoItem(userId, user => {
      if (user === undefined || user === null || user.timeZoneId === undefined || user.timeZoneId === null) {
        updateUserLocation.call(this, (err) => {
          if (err) {
            ctx.emit(':tell', `Error with Milky Baby!`)
          } else {
            readDynamoItem(userId, user => {
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

    readDynamoItem(userId, user => {
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
    this.emit(':tell', 'Welcome to the Milky Baby Skill!')
  },

  'AMAZON.CancelIntent': function () {
    this.emit(':tell', 'Thank you for trying the Milky Baby Skill. Have a nice day!')
  },

  'AMAZON.StopIntent': function () {
    this.emit(':tell', 'Thank you for trying the Milky Baby Skill. Have a nice day!')
  },
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
