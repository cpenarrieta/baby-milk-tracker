const Alexa = require('alexa-sdk')
const AWS = require('aws-sdk')
const moment = require('moment-timezone')
const https = require('https')
const axios = require('axios')

const AWSregion = 'us-east-1'
const TABLE_USER = 'milky_baby_user'
const SKILL_ID = 'amzn1.ask.skill.2cb7cf3a-c642-4db2-b5d2-a27c0cb1f387'

let getParams = {
  TableName: TABLE_USER,
  Key: { 
    userId: '',
  }
}

let putParams = {
  TableName: TABLE_USER,
  Item: { 
    userId: '',
    unit: 'ml',
  }
}

AWS.config.update({
  region: AWSregion
})

function updateUserLocation(cb) {
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
    getParams.Key.userId = userId

    // get current user data
    readDynamoItem(getParams, user => {
      putParams.Item.userId = userId
      if (user) {
        if (user.milks)
          putParams.Item.milks = user.milks
        if (user.unit)
          putParams.Item.unit = user.unit
      }
      putParams.Item.countryCode = countryCode
      putParams.Item.postalCode = postalCode
      putParams.Item.city = city
      putParams.Item.state = state
      putParams.Item.timeZoneId = timeZoneId
      putParams.Item.lat = lat
      putParams.Item.lng = lng

      // update user data
      putUser(putParams, result => {
        cb(false)
      })
    })
  })
  .catch((err) => {
    console.log(err)
    cb(true)
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
    const userId = this.event.session.user.userId
    getParams.Key.userId = userId

    const { amount: amountStr, unit } = this.event.request.intent.slots
    const amount = parseInt(amountStr.value, 10)
    if (isNaN(amount))
      this.emit(':tell', "Please indicate a correct number to add, for example: 'ask milky baby to add 60 oz.'")
    if (!isValidUnit(unit.id))
      this.emit(':tell', "Invalid unit measure, we only support ounce or milliliter.")

    const ctx = this
    
    const insertMilkRecord = (user) => {
      let milks = []
      if (user && user.milks) {
        milks = user.milks
      }
      
      const currDate = new moment()
      const date = currDate.tz(user.timeZoneId).format('YYYY-MM-DD HH:mm')

      milks.push({ amount, unit: unit.id, date })
      putParams.Item.milks = milks
      putParams.Item.userId = userId
      putParams.Item.unit = unit.id
      if (user) {
        if (user.countryCode)
          putParams.Item.countryCode = user.countryCode
        if (user.postalCode)
          putParams.Item.postalCode = user.postalCode
        if (user.city)
          putParams.Item.city = user.city
        if (user.state)
          putParams.Item.state = user.state
        if (user.timeZoneId)
          putParams.Item.timeZoneId = user.timeZoneId
        if (user.lat)
          putParams.Item.lat = user.lat
        if (user.lng)
          putParams.Item.lng = user.lng
      }

      putUser(putParams, result => {
        ctx.emit(':tell', `${amount} ${unit.value} added.`)
      })
    }

    readDynamoItem(getParams, user => {
      if (user === undefined || user === null || user.timeZoneId === undefined || user.timeZoneId === null) {
        updateUserLocation.call(this, (err) => {
          if (err) {
            ctx.emit(':tell', `Error with Milky Baby!`)
          } else {
            readDynamoItem(getParams, user => {
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
    getParams.Key.userId = userId

    readDynamoItem(getParams, user => {
      const date = new moment()
      const today = date.tz(user.timeZoneId)
      const unit = user.unit
      let lastFeefingTime = ''
      let total = 0

      user.milks.forEach((m, key) => {
        const dateItem = moment(m.date)
        if (today.day() === dateItem.day()) {
          if (m.unit === unit) {
            total += m.amount
          } else if (m.unit === 'ml' && unit === 'oz') {
            total += mlToOz(m.amount)
          } else if (m.unit === 'ml' && unit === 'oz') {
            total += ozToMl(m.amount)
          }
        }

        if (user.milks.length - 1 === key) {
          lastFeefingTime = dateItem.format('h:mm A')
        }
      })
      this.emit(':tell', `Your baby consumed about ${total} ${unit} today. The last feeding time was at ${lastFeefingTime}.`)
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

function isValidUnit(unit) {
  if (unit !== 'oz' || unit !== 'ml') {
    return false
  }
  return true
}

function readDynamoItem(params, callback) {
  const docClient = new AWS.DynamoDB.DocumentClient()
  
  docClient.get(params, (err, data) => {
    if (err) {
      console.error("Unable to GET item. Error JSON:", JSON.stringify(err, null, 2))
    } else {
      callback(data.Item)
    }
  })
}

function mlToOz(amount) {
  return amount * 0.033814
}

function ozToMl(amount) {
  return amount * 29.5735
}

function putUser(putParams, callback) {
  const docClient = new AWS.DynamoDB.DocumentClient()

  docClient.put(putParams, (err, data) => {
    if (err) {
      console.error("Unable to PUT item. Error JSON:", JSON.stringify(err, null, 2))
    } else {
      console.log('data from PUT', JSON.stringify(data, null, 2))
      callback(data)
    }
  })
}

exports.handler = function(event, context, callback) {
  const alexa = Alexa.handler(event, context)
  alexa.appId = SKILL_ID
  alexa.registerHandlers(handlers)
  alexa.execute()
}
