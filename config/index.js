/* eslint @typescript-eslint/unbound-method: 0 */
/* eslint @typescript-eslint/no-var-requires: 0 */
/* eslint @typescript-eslint/no-unsafe-assignment: 0 */
const { join } = require('path')

const profile = process.env.PROFILE || 'local'
const configProfile = require(join(__dirname, profile))

module.exports = configProfile
