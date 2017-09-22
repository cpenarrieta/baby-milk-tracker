const axios = require('axios')

const { getUser, putUser } = require('./dynamoHelper')
const { POSTAL_REQUIRED_ERROR } = require('./errorCodes')

function updateUserLocation(callback) {
  const userId = this.event.session.user.userId
  const consentToken = this.event.session.user.permissions.consentToken
  const deviceId = this.event.context.System.device.deviceId
  let countryCode = ''
  let postalCode = ''
  let lat = 0
  let lng = 0
  let city = ''
  let state = ''
  let timeZoneId = ''

  axios.get(`https://api.amazonalexa.com/v1/devices/${deviceId}/settings/address/countryAndPostalCode`, {
    headers: { 'Authorization': `Bearer ${consentToken}` }
  })
  .then((response) => {
    if (!response.data || !response.data.countryCode || !response.data.postalCode) {
      callback(POSTAL_REQUIRED_ERROR)
    }

    countryCode = response.data.countryCode
    postalCode = response.data.postalCode
    return axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${countryCode},${postalCode}&key=${process.env.GOOGLE_MAPS_KEY}`)
  })
  .then((response) => {
    city = response.data.results[0].address_components[1].short_name
    state = response.data.results[0].address_components[3].short_name
    lat = response.data.results[0].geometry.location.lat
    lng = response.data.results[0].geometry.location.lng
    return axios.get(`https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${moment().unix()}&key=${process.env.GOOGLE_MAPS_KEY}`)
  })
  .then((response) => {
    timeZoneId = response.data.timeZoneId
    getUser(userId, user => {
      const putParams = Object.assign({}, user, { userId, countryCode, postalCode, city, state, timeZoneId, lat, lng })
      putUser(putParams, result => {
        callback(false)
      })
    })
  })
  .catch((err) => {
    console.error('ERROR during updateUserLocation', err)
    callback(true)
  })
}

module.exports = updateUserLocation
