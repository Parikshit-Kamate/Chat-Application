const { MAX_JWT_LENGTH, crypto, JWT_CLOCK_SKEW_SECONDS, normalizeObjectId } = require('./constants');

function createVerifyJwtToken({ jwtSecret }) {
  return function verifyJwtToken(token) {
    if (typeof token !== 'string' || token.length === 0 || token.length > MAX_JWT_LENGTH) {
      throw new Error('Invalid token format');
    }
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }
    const [encodedHeader, body, signature] = parts;
    if (!parts.every(part => /^[a-z0-9_-]+$/i.test(part)) ||
      Buffer.from(encodedHeader, 'base64url').toString('base64url') !== encodedHeader ||
      Buffer.from(body, 'base64url').toString('base64url') !== body ||
      Buffer.from(signature, 'base64url').toString('base64url') !== signature) {
      throw new Error('Invalid token encoding');
    }
    const header = JSON.parse(Buffer.from(encodedHeader, 'base64url').toString('utf8'));
    if (!header || header.alg !== 'HS256' || header.typ !== 'JWT') {
      throw new Error('Invalid token header');
    }
    const expectedSignature = crypto.createHmac('sha256', jwtSecret).update(`${encodedHeader}.${body}`).digest();
    const suppliedSignature = Buffer.from(signature, 'base64url');
    if (suppliedSignature.length !== expectedSignature.length) {
      throw new Error('Invalid signature');
    }
    const isValid = crypto.timingSafeEqual(suppliedSignature, expectedSignature);
    if (!isValid) {
      throw new Error('Invalid signature');
    }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('Invalid token payload');
    }
    if (!Number.isSafeInteger(payload.iat) || !Number.isSafeInteger(payload.exp)) {
      throw new Error('Invalid token timestamps');
    }
    if (payload.iat > now + JWT_CLOCK_SKEW_SECONDS || payload.exp <= payload.iat || payload.exp <= now) {
      throw new Error('Token expired');
    }
    const normalizedSubject = normalizeObjectId(payload.sub);
    if (!normalizedSubject) {
      throw new Error('Invalid token subject');
    }
    payload.sub = normalizedSubject;
    if (payload.username !== undefined && (typeof payload.username !== 'string' || payload.username.length > 30)) {
      throw new Error('Invalid token username');
    }
    return payload;
  };
}

module.exports = createVerifyJwtToken;
