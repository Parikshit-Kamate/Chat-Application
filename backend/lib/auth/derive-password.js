const { crypto, PASSWORD_KEY_BYTES, PASSWORD_DIGEST } = require('./constants');

function derivePassword(password, salt, iterations) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, iterations, PASSWORD_KEY_BYTES, PASSWORD_DIGEST, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey);
    });
  });
}

module.exports = derivePassword;
