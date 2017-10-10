const sendIntent = require('./_utils/send-intent')
const { incorrectNumberMessage, invalidUnitMessage } = require('../messages')

test('submitMilkIntent should add 100 ml', (done) => {
  sendIntent('submitMilkIntent', (err, res) => {
    const outputText = err ? 'error' : res.response.outputSpeech.ssml
    expect(outputText).toBe('<speak> 100 ml added. </speak>')
    done()
  })
})

test('submitMilkIntent should validate number', (done) => {
  sendIntent('submitMilkIntent-wrong-number', (err, res) => {
    const outputText = err ? 'error' : res.response.outputSpeech.ssml
    expect(outputText).toBe(`<speak> ${incorrectNumberMessage} </speak>`)
    done()
  })
})

test('submitMilkIntent should validate unit', (done) => {
  sendIntent('submitMilkIntent-wrong-unit', (err, res) => {
    const outputText = err ? 'error' : res.response.outputSpeech.ssml
    expect(outputText).toBe(`<speak> ${invalidUnitMessage} </speak>`)
    done()
  })
})
