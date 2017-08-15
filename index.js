const Alexa = require('alexa-sdk')
const AWS = require('aws-sdk')

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
    milks: [],
  }
}

AWS.config.update({
  region: AWSregion
})

exports.handler = function(event, context, callback) {
  const alexa = Alexa.handler(event, context)
  alexa.appId = SKILL_ID
  alexa.registerHandlers(handlers)
  alexa.execute()
}

const handlers = {
  'LaunchRequest': function () {
    this.emit(':tell', 'Welcome to the Milky Baby Skill!')
  },

  'SubmitMilkIntent': function () {
    const userId = this.event.session.user.userId
    getParams.Key.userId = userId
    putParams.Item.userId = userId

    const { amount, unit } = this.event.request.intent.slots
    const date = this.event.request.timestamp
    const locale = this.event.request.locale

    readDynamoItem(getParams, user => {
      let milks = []
      if (user && user.milks) {
        milks = user.milks
      }

      milks.push({ amount: amount.value, unit: unit.value, date })
      putParams.Item.milks = milks
      putParams.Item.unit = unit
      putParams.Item.locale = locale

      addMilkItem(putParams, result => {
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

  'ChangeBirthdayIntent': function () {
    this.emit(':tell', 'Change Birthday Intent!')
  },

  'AMAZON.HelpIntent': function () {
    this.emit(':tell', 'Welcome to the Milky Baby Skill!')
  },

  'AMAZON.CancelIntent': function () {
    this.emit(':tell', 'Thank you for trying the Milky Baby Skill. Have a nice day!')
  },

  'AMAZON.StopIntent': function () {
    this.emit(':tell', 'Thank you for trying the Milky Baby Skill. Have a nice day!')
  }
}

function readDynamoItem(params, callback) {
  const docClient = new AWS.DynamoDB.DocumentClient()
  
  docClient.get(params, (err, data) => {
    if (err) {
      console.error("Unable to GET item. Error JSON:", JSON.stringify(err, null, 2))
    } else {
      console.log("GET item JSON:", JSON.stringify(data.Item, null, 2))
      callback(data.Item)
    }
  })
}

function addMilkItem(putParams, callback) {
  const docClient = new AWS.DynamoDB.DocumentClient()

  docClient.put(putParams, (err, data) => {
    if (err) {
      console.error("Unable to PUT item. Error JSON:", JSON.stringify(err, null, 2))
    } else {
      callback(data)
    }
  })
}
