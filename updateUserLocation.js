const axios = require('axios')
const moment = require('moment-timezone')

const { getUser, putUser } = require('./dynamoHelper')
const { POSTAL_REQUIRED_ERROR, GOOGLE_MAP_GEOCODE_EMPTY_RESULT, GOOGLE_MAP_TIMEZONE_EMPTY_RESULT } = require('./errorCodes')

function updateUserLocation(callback) {
  const userId = this.event.session.user.userId
  const consentToken = this.event.session.user.permissions && this.event.session.user.permissions.consentToken
  const deviceId = this.event.context.System.device.deviceId
  let countryCode = ''
  let postalCode = ''
  let lat = 0
  let lng = 0
  let city = ''
  let state = ''
  let timeZoneId = ''

  if (!consentToken || !deviceId) {
    console.error('ERROR updateUserLocation.POSTAL_REQUIRED_ERROR', consentToken, deviceId)
    callback(POSTAL_REQUIRED_ERROR)
  }

  axios.get(`https://api.amazonalexa.com/v1/devices/${deviceId}/settings/address/countryAndPostalCode`, {
    headers: { 'Authorization': `Bearer ${consentToken}` }
  })
  .then((response) => {
    if (!response.data || !response.data.countryCode || !response.data.postalCode) {
      console.error('ERROR updateUserLocation.POSTAL_REQUIRED_ERROR', consentToken, deviceId, response.data)
      callback(POSTAL_REQUIRED_ERROR)
    } else {
      countryCode = response.data.countryCode
      postalCode = response.data.postalCode
      return axios.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${countryCode},${postalCode}&key=${process.env.GOOGLE_MAPS_KEY}`)
    }
  })
  .then((response) => {
    if (!response.data || !response.data.results || !response.data.results[0] || 
      !response.data.results[0].address_components || !response.data.results[0].geometry) {
      console.error('ERROR updateUserLocation.GOOGLE_MAP_GEOCODE_EMPTY_RESULT', response)
      callback(GOOGLE_MAP_GEOCODE_EMPTY_RESULT)
    } else {
      city = response.data.results[0].address_components[1].short_name
      state = response.data.results[0].address_components[3].short_name
      lat = response.data.results[0].geometry.location.lat
      lng = response.data.results[0].geometry.location.lng
      return axios.get(`https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${moment().unix()}&key=${process.env.GOOGLE_MAPS_KEY}`)
    }
  })
  .then((response) => {
    if (!response.data || !response.data.timeZoneId) {
      console.error('ERROR updateUserLocation.GOOGLE_MAP_TIMEZONE_EMPTY_RESULT', response)
      callback(GOOGLE_MAP_TIMEZONE_EMPTY_RESULT)
    } else {
      timeZoneId = response.data.timeZoneId
      getUser(userId, user => {
        const putParams = Object.assign({}, user, { userId, countryCode, postalCode, city, state, timeZoneId, lat, lng })
        putUser(putParams, result => {
          callback(false)
        })
      })
    }
  })
  .catch((err) => {
    console.error('ERROR updateUserLocation.POSTAL_REQUIRED_ERROR', err)
    if (!consentToken || !deviceId) {
      callback(POSTAL_REQUIRED_ERROR)
    } else {
      callback(true)
    }
  })
}

module.exports = updateUserLocation
