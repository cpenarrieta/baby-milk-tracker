// alexa-cookbook sample code

// There are three sections, Text Strings, Skill Code, and Helper Function(s).
// You can copy and paste the entire file contents as the code for a new Lambda function,
//  or copy & paste section #3, the helper function, to the bottom of your existing Lambda code.


// 1. Text strings =====================================================================================================
// Modify these strings and messages to change the behavior of your Lambda function

var AWSregion = 'us-east-1'

const TABLE_USER = 'milky_baby_user'
const SKILL_ID = 'amzn1.ask.skill.2cb7cf3a-c642-4db2-b5d2-a27c0cb1f387'

var params = {
  TableName: 'milky_baby_user',
  Key: { "userId": '0' }
}


// 2. Skill Code =======================================================================================================

var Alexa = require('alexa-sdk')
var AWS = require('aws-sdk')

AWS.config.update({
  region: AWSregion
})

exports.handler = function(event, context, callback) {
  var alexa = Alexa.handler(event, context)

  alexa.appId = SKILL_ID
  alexa.dynamoDBTableName = TABLE_USER

  alexa.registerHandlers(handlers)
  alexa.execute()
}

var handlers = {
  'LaunchRequest': function () {
    // this.emit(':ask', 'welcome to magic answers.  ask me a yes or no question.', 'try again')
    // this.emit(':tell', 'This test works!')
    this.emit(':tell', 'LaunchRequest')
  },

  'SubmitMilkIntent': function () {
    this.emit(':tell', 'Submit Milk Intent!')
  },

  'WhatsMyStatusIntent': function () {
    this.emit(':tell', 'Whats My Status Intent!')
  },

  'ChangeBirthdayIntent': function () {
    this.emit(':tell', 'Change Birthday Intent!')
  },

  'AMAZON.HelpIntent': function () {
    // this.emit(':ask', 'ask me a yes or no question.', 'try again')
    this.emit(':tell', 'HelpIntent!')
  },

  'AMAZON.CancelIntent': function () {
    this.emit(':tell', 'Goodbye!')
  },

  'AMAZON.StopIntent': function () {
    this.emit(':tell', 'Goodbye!')
  }
}

  // 'MyIntent': function () {
  //   var MyQuestion = this.event.request.intent.slots.MyQuestion.value
  //   console.log('MyQuestion : ' + MyQuestion)

  //   readDynamoItem(params, myResult => {
  //     var say = ''
  //     say = myResult
  //     say = 'you asked, ' + MyQuestion + '. The answer is: ' + myResult
  //     this.emit(':ask', say, 'try again')
  //   })
  // },

//    END of Intent Handlers {} ========================================================================================
// 3. Helper Function  =================================================================================================

function readDynamoItem(params, callback) {
  var AWS = require('aws-sdk')
  AWS.config.update({ region: AWSregion })

  var docClient = new AWS.DynamoDB.DocumentClient()

  console.log('reading item from DynamoDB table')

  docClient.get(params, (err, data) => {
    if (err) {
      console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2))
    } else {
      console.log("GetItem succeeded:", JSON.stringify(data, null, 2))
      callback(data.Item.message)  // this particular row has an attribute called message
    }
  })
}
