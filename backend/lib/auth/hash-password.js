const { crypto, CURRENT_PASSWORD_ITERATIONS, PASSWORD_SCHEME } = require('./constants');
const derivePassword = require('./derive-password');
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const digest = await derivePassword(String(password), salt, CURRENT_PASSWORD_ITERATIONS);
  return `${PASSWORD_SCHEME}:${CURRENT_PASSWORD_ITERATIONS}:${salt}:${digest.toString('hex')}`;
}

module.exports = hashPassword;
