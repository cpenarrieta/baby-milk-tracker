const sendIntent = require('../_utils/send-intent')
const { incorrectNumberMessage, invalidUnitMessage } = require('../../messages')

test('submitMilkIntent should add 100 ml', (done) => {
  expect(1).toBe(1)
  const request = require(`./req-100-ml.json`)
  sendIntent(request, (err, res) => {
    const outputText = err ? 'error' : res.response.outputSpeech.ssml
    expect(outputText).toBe('<speak> 100 ml added. </speak>')
    done()
  })
})

test('submitMilkIntent should validate number', (done) => {
  const request = require(`./req-wrong-number.json`)
  sendIntent(request, (err, res) => {
    const outputText = err ? 'error' : res.response.outputSpeech.ssml
    expect(outputText).toBe(`<speak> ${incorrectNumberMessage} </speak>`)
    done()
  })
})

test('submitMilkIntent should validate unit', (done) => {
  const request = require(`./req-wrong-unit.json`)
  sendIntent(request, (err, res) => {
    const outputText = err ? 'error' : res.response.outputSpeech.ssml
    expect(outputText).toBe(`<speak> ${invalidUnitMessage} </speak>`)
    done()
  })
})