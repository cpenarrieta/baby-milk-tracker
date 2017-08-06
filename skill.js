'use strict'

/**
* This sample demonstrates a simple skill built with the Amazon Alexa Skills Kit.
* The Intent Schema, Custom Slots, and Sample Utterances for this skill, as well as
* testing instructions are located at http://amzn.to/1LzFrj6
*
* For additional samples, visit the Alexa Skills Kit Getting Started guide at
* http://amzn.to/1LGWsLG
*/


// --------------- Helpers that build all of the responses -----------------------

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
  return {
    outputSpeech: {
      type: 'PlainText',
      text: output,
    },
    card: {
      type: 'Simple',
      title: `${title}`,
      content: `${output}`,
    },
    reprompt: {
      outputSpeech: {
          type: 'PlainText',
          text: repromptText,
      },
    },
    shouldEndSession,
  }
}

function buildResponse(sessionAttributes, speechletResponse) {
  return {
    version: '1.0',
    sessionAttributes,
    response: speechletResponse,
  }
}


// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
  // TODO check if birthday already exists
  // If we wanted to initialize the session to have some attributes we could add those here.
  const sessionAttributes = {}
  const cardTitle = 'Welcome'
  const speechOutput = 'Welcome to the Milky Baby Skill. ' +
      'Please tell me your baby\'s birthday'

  const repromptText = 'Please tell me your baby\'s birthday'
  const shouldEndSession = false

  callback(sessionAttributes,
      buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession))
}

function handleSessionEndRequest(callback) {
  const cardTitle = 'Session Ended'
  const speechOutput = 'Thank you for trying the Milky Baby Skill. Have a nice day!'
  // Setting this to true ends the session and exits the skill.
  const shouldEndSession = true

  callback({}, buildSpeechletResponse(cardTitle, speechOutput, null, shouldEndSession))
}

function submitMilkIntent(intent, session, callback) {
  const cardTitle = intent.name

  const { amount, unit } = intent.slots

  let repromptText = ''
  let sessionAttributes = {}
  const shouldEndSession = true
  let speechOutput = ''

  speechOutput = `You selected ${amount.value} ${unit.value}`
  repromptText = "You can submit your milk amount by saying for example. Add 80 milliliter."

  callback(sessionAttributes,
      buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession))
}

function whatsMyStatusIntent(intent, session, callback) {
  const repromptText = null
  const sessionAttributes = {}
  let shouldEndSession = true
  let speechOutput = ''

  const total = 230
  const unit = 'milliliters'
  speechOutput = `Your baby consumed about ${230} ${unit} today. The next feeding time is at 4pm`

  // Setting repromptText to null signifies that we do not want to reprompt the user.
  // If the user does not respond or says something that is not understood, the session
  // will end.
  callback(sessionAttributes,
        buildSpeechletResponse(intent.name, speechOutput, repromptText, shouldEndSession))
}


// --------------- Events -----------------------

/**
* Called when the session starts.
*/
function onSessionStarted(sessionStartedRequest, session) {
  console.log(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`)
}

/**
* Called when the user launches the skill without specifying what they want.
*/
function onLaunch(launchRequest, session, callback) {
  console.log(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`)

  // Dispatch to your skill's launch.
  getWelcomeResponse(callback)
}

/**
* Called when the user specifies an intent for this skill.
*/
function onIntent(intentRequest, session, callback) {
  console.log(`onIntent requestId=${intentRequest.requestId}, sessionId=${session.sessionId}`)

  const intent = intentRequest.intent
  const intentName = intentRequest.intent.name

  // Dispatch to your skill's intent handlers
  if (intentName === 'SubmitMilkIntent') {
    submitMilkIntent(intent, session, callback)
  } else if (intentName === 'WhatsMyStatusIntent') {
    whatsMyStatusIntent(intent, session, callback)
  } else if (intentName === 'AMAZON.HelpIntent') {
    getWelcomeResponse(callback)
  } else if (intentName === 'AMAZON.StopIntent' || intentName === 'AMAZON.CancelIntent') {
    handleSessionEndRequest(callback)
  } else {
    throw new Error('Invalid intent')
  }
}

/**
* Called when the user ends the session.
* Is not called when the skill returns shouldEndSession=true.
*/
function onSessionEnded(sessionEndedRequest, session) {
  console.log(`onSessionEnded requestId=${sessionEndedRequest.requestId}, sessionId=${session.sessionId}`)
  // Add cleanup logic here
}


// --------------- Main handler -----------------------

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = (event, context, callback) => {
  try {
    console.log(`event.session.application.applicationId=${event.session.application.applicationId}`)

    /**
    * Uncomment this if statement and populate with your skill's application ID to
    * prevent someone else from configuring a skill that sends requests to this function.
    */
    /*
    if (event.session.application.applicationId !== 'amzn1.echo-sdk-ams.app.[unique-value-here]') {
          callback('Invalid Application ID')
    }
    */

    if (event.session.new) {
      onSessionStarted({ requestId: event.request.requestId }, event.session)
    }

    if (event.request.type === 'LaunchRequest') {
      onLaunch(event.request,
          event.session,
          (sessionAttributes, speechletResponse) => {
              callback(null, buildResponse(sessionAttributes, speechletResponse))
          })
    } else if (event.request.type === 'IntentRequest') {
      onIntent(event.request,
          event.session,
          (sessionAttributes, speechletResponse) => {
              callback(null, buildResponse(sessionAttributes, speechletResponse))
          })
    } else if (event.request.type === 'SessionEndedRequest') {
      onSessionEnded(event.request, event.session)
      callback()
    }
  } catch (err) {
    callback(err)
  }
}
