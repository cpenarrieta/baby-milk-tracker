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

const handlers = {
  'LaunchRequest': function () {
    let countryCode = ''
    let postalCode = ''
    let lat = 0
    let lng = 0
    let city = ''
    let state = ''
    let timeZoneId = ''
    const userId = this.event.session.user.userId
    const consentToken = this.event.session.user.permissions.consentToken
    const deviceId = this.event.context.System.device.deviceId

    var ctx = this

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
        if (user.milks)
          putParams.Item.milks = user.milks
        if (user.unit)
          putParams.Item.unit = user.unit
        putParams.Item.countryCode = countryCode
        putParams.Item.postalCode = postalCode
        putParams.Item.city = city
        putParams.Item.state = state
        putParams.Item.timeZoneId = timeZoneId
        putParams.Item.lat = lat
        putParams.Item.lng = lng

        // update user data
        putUser(putParams, result => {
          ctx.emit(':tell', `Launch Request! ${timeZoneId}`)
        })
      })
    })
    .catch((err) => {
      ctx.emit(':tell', `Error with Milky Baby!`)
    })
  },

  'SubmitMilkIntent': function () {
    const userId = this.event.session.user.userId
    getParams.Key.userId = userId

    const { amount, unit } = this.event.request.intent.slots
    const currDate = new moment()

    readDynamoItem(getParams, user => {
      let milks = []
      if (user && user.milks) {
        milks = user.milks
      }

      const date = currDate.tz(user.timeZoneId).format('YYYY-M-D h:mm:ss a')

      milks.push({ amount: amount.value, unit: unit.value, date })
      putParams.Item.milks = milks
      putParams.Item.userId = userId
      putParams.Item.unit = unit.value
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

      putUser(putParams, result => {
        this.emit(':tell', `You selected ${amount.value} ${unit.value}`)
      })
    })
  },

  'WhatsMyStatusIntent': function () {
    const userId = this.event.session.user.userId
    getParams.Key.userId = userId

    readDynamoItem(getParams, user => {
      const unit = user.unit
      let total = 0
      user.milks.forEach(m => {
        total += parseInt(m.amount, 10)
      })
      this.emit(':tell', `Your baby consumed about ${total} ${unit} today. The next feeding time is at 4pm`)
    })
  },

  'openIntent': function () {
    const { state, birthday } = this.event.request.intent.slots
    this.emit(':tell', `Opening Intent! you selected ${state.value} and ${birthday.value}`)
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

function putUser(putParams, callback) {
  const docClient = new AWS.DynamoDB.DocumentClient()

  docClient.put(putParams, (err, data) => {
    if (err) {
      console.error("Unable to PUT item. Error JSON:", JSON.stringify(err, null, 2))
    } else {
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
