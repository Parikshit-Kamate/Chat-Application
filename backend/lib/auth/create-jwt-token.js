const { crypto } = require('./constants');

function bindCreateJwtToken({ jwtExpiresInSeconds, jwtSecret }) {
  return function createJwtToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const body = Buffer.from(JSON.stringify({ ...payload, iat: now, exp: now + jwtExpiresInSeconds })).toString('base64url');
    const signature = crypto.createHmac('sha256', jwtSecret).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  };
}

module.exports = bindCreateJwtToken;
