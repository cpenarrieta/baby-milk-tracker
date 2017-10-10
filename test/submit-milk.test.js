const sendIntent = require('./send-intent')

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
    expect(outputText).toBe("<speak> Please indicate a correct number to add, for example: 'add 60 ounces.' </speak>")
    done()
  })
})

test('submitMilkIntent should validate unit', (done) => {
  sendIntent('submitMilkIntent-wrong-unit', (err, res) => {
    const outputText = err ? 'error' : res.response.outputSpeech.ssml
    expect(outputText).toBe("<speak> Invalid unit measure, we only support ounces or milliliters. </speak>")
    done()
  })
})
