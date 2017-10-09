var roleArn = process.env.AWS_ROLE
var region = 'us-east-1'

var AWS = require('aws-sdk')

function context() {
  var context = require('./context.json')
  context.done = function(error, result) {
    console.log('context.done')
    console.log(error)
    console.log(result)
    process.exit()
  }
  context.succeed = function(result) {
    console.log('context.succeed')
    console.log(result)
    process.exit()
  }
  context.fail = function(error) {
    console.log('context.fail')
    console.log(error)
    process.exit()
  }

  return context
}

AWS.config.region = region
var sts = new AWS.STS()
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
    var Module = require('module')
    var originalRequire = Module.prototype.require
    Module.prototype.require = function(){
      if (arguments[0] === 'aws-sdk'){
        return AWS;
      } else {
        return originalRequire.apply(this, arguments)
      }
    }
    var lambda = require('../index')
    var event = require('./input.json')
    lambda.handler(event, context())
  }
})