const crypto = require('crypto');

function createDeliverySignature(path, secret, algorithm = 'sha256') {
  if (!['sha256', 'sha1'].includes(algorithm)) throw new Error('Unsupported signature algorithm.');
  return crypto.createHash(algorithm).update(`${path}${secret}`)
    .digest('base64url').slice(0, 8);
}

module.exports = { createDeliverySignature };
