const Alexa = require('alexa-sdk')
const AWS = require('aws-sdk')
const https = require('https')

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
    const userId = this.event.session.user.userId
    const consentToken = this.event.session.user.permissions.consentToken
    const deviceId = this.event.context.System.device.deviceId
    const url = `/v1/devices/${deviceId}/settings/address/countryAndPostalCode`
    
    var ctx = this
    
    https.get({
      hostname: 'api.amazonalexa.com',
      path: url,
      headers: {
        'Authorization': `Bearer ${consentToken}`
      }
    }, function(res) {
      res.on('data', function(body) {
        const obj = JSON.parse(body)
        countryCode = obj.countryCode
        postalCode = obj.postalCode
      })

      res.on('end', function(res) {
        getParams.Key.userId = userId
        readDynamoItem(getParams, user => {
          putParams.Item.userId = userId
          if (user.milks)
            putParams.Item.milks = user.milks
          if (user.unit)
            putParams.Item.unit = user.unit
          putParams.Item.countryCode = countryCode
          putParams.Item.postalCode = postalCode

          putUser(putParams, result => {
            ctx.emit(':tell', `Launch Request! ${postalCode}`)
          })
        })
      })
    }).on('error', function(e) {
      console.log("Got error: " + e.message)
    })
  },

  'SubmitMilkIntent': function () {
    const userId = this.event.session.user.userId
    getParams.Key.userId = userId

    const { amount, unit } = this.event.request.intent.slots

    readDynamoItem(getParams, user => {
      let milks = []
      if (user && user.milks) {
        milks = user.milks
      }

      milks.push({ amount: amount.value, unit: unit.value, date: (new Date()).toString() })
      putParams.Item.milks = milks
      putParams.Item.userId = userId
      putParams.Item.unit = unit.value
      if (user.countryCode)
        putParams.Item.countryCode = user.countryCode
      if (user.postalCode)
        putParams.Item.postalCode = user.postalCode

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
