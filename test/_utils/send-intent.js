const roleArn = process.env.AWS_ROLE
const region = 'us-east-1'
const AWS = require('aws-sdk')

function context(callback) {
  const contextEvent = require('./context.json')

  contextEvent.done = function(error, result) {
    callback(true, error)
  }

  contextEvent.succeed = function(result) {
    callback(false, result)
  }

  contextEvent.fail = function(error) {
    callback(true, error)
  }

  return contextEvent
}

AWS.config.region = region
const sts = new AWS.STS()

function send(input, callback) {
  sts.assumeRole({
    RoleArn: roleArn,
    RoleSessionName: 'emulambda'
  }, function(err, data) {
    if (err) {
      console.log('Cannot assume role')
      console.log(err, err.stack)
    } else {
      AWS.config.update({
        accessKeyId: data.Credentials.AccessKeyId,
        secretAccessKey: data.Credentials.SecretAccessKey,
        sessionToken: data.Credentials.SessionToken
      })
      const Module = require('module')
      const originalRequire = Module.prototype.require
      Module.prototype.require = function(){
        if (arguments[0] === 'aws-sdk'){
          return AWS;
        } else {
          return originalRequire.apply(this, arguments)
        }
      }
      const lambda = require('../../index')
      const event = require(`../${input}.json`)
      lambda.handler(event, context(callback))
    }
  })
}

module.exports = send
