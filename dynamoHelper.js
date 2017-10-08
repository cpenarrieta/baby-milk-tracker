const AWS = require('aws-sdk')
const moment = require('moment-timezone')

const AWSregion = 'us-east-1'
const TABLE_USER = 'milky_baby_user'

AWS.config.update({
  region: AWSregion
})

function getUser(userId, callback) {
  const req = {
    TableName: TABLE_USER,
    Key: { userId }
  }

  const docClient = new AWS.DynamoDB.DocumentClient()
  
  docClient.get(req, (err, data) => {
    if (err) {
      console.error("Unable to GET item. Error JSON:", JSON.stringify(err, null, 2))
    } else {
      callback(data.Item)
    }
  })
}

function putUser(putParams, callback) {
  const updatedDate = (new moment()).format('YYYY-MM-DD HH:mm')
  const req = {
    TableName: TABLE_USER,
    Item: Object.assign({}, putParams, { updatedDate }),
    ReturnValues: 'ALL_OLD'
  }
  const docClient = new AWS.DynamoDB.DocumentClient()

  docClient.put(req, (err, data) => {
    if (err) {
      console.error("Unable to PUT item. Error JSON:", JSON.stringify(err, null, 2))
    } else {
      callback(data)
    }
  })
}

module.exports = { getUser, putUser }
