const welcomeMessage = `Welcome to the Milky Baby skill, add your feeding baby milk amount to your account by saying for example: 
  'add 3 ounces'. This will save this data to your account and we we will provide you
  summarized information by saying: 'what's my status'.
  Thanks for using Milky Baby.`
const milkEmptyMessage = `You havent added any milk amount yet. Add your feeding baby milk amount to your account by saying for example: 'add 3 ounces'.`
const againMessage = 'Please say that again?'
const grantDeviceLocationMessage = `Please grant device location settings permissions to the skill in order to get your current time.`
const errorMilkyBabyMessage = `Error with Milky Baby skill, please try again`
const invalidUnitMessage = "Invalid unit measure, we only support ounces or milliliters."
const incorrectNumberMessage = "Please indicate a correct number to add, for example: 'add 60 ounces.'"
const thankYouMessage = 'Thank you for trying the Milky Baby Skill. Have a nice day!'

module.exports = {
  welcomeMessage,
  milkEmptyMessage,
  againMessage,
  grantDeviceLocationMessage,
  errorMilkyBabyMessage,
  invalidUnitMessage,
  incorrectNumberMessage,
  thankYouMessage
}
