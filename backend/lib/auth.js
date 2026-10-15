const crypto = require('crypto');
const { normalizeObjectId } = require('./object-id');

const CURRENT_PASSWORD_ITERATIONS = 220_000;
const LEGACY_PASSWORD_ITERATIONS = 120_000;
const PASSWORD_DIGEST = 'sha512';
const PASSWORD_KEY_BYTES = 64;
const PASSWORD_SCHEME = 'pbkdf2-sha512';
const JWT_CLOCK_SKEW_SECONDS = 60;
const MAX_JWT_LENGTH = 4096;

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

function parsePasswordHash(storedValue) {
  const parts = String(storedValue || '').split(':');
  let iterations;
  let salt;
  let digest;

  if (parts.length === 2) {
    [salt, digest] = parts;
    iterations = LEGACY_PASSWORD_ITERATIONS;
  } else if (parts.length === 4 && parts[0] === PASSWORD_SCHEME) {
    iterations = Number(parts[1]);
    salt = parts[2];
    digest = parts[3];
  } else {
    return null;
  }

  if (
    !Number.isSafeInteger(iterations) ||
    iterations < LEGACY_PASSWORD_ITERATIONS ||
    iterations > 1_000_000 ||
    !/^[a-f0-9]{32}$/i.test(salt) ||
    !/^[a-f0-9]{128}$/i.test(digest)
  ) {
    return null;
  }

  return {
    digest: Buffer.from(digest, 'hex'),
    iterations,
    salt,
  };
}

function createAuthHelpers({ jwtSecret, jwtExpiresInSeconds }) {
  async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const digest = await derivePassword(String(password), salt, CURRENT_PASSWORD_ITERATIONS);
    return `${PASSWORD_SCHEME}:${CURRENT_PASSWORD_ITERATIONS}:${salt}:${digest.toString('hex')}`;
  }

  async function verifyPassword(password, storedValue) {
    const parsedHash = parsePasswordHash(storedValue);
    const comparisonHash = parsedHash || {
      digest: Buffer.alloc(PASSWORD_KEY_BYTES),
      iterations: CURRENT_PASSWORD_ITERATIONS,
      salt: '0'.repeat(32),
    };
    const computedDigest = await derivePassword(String(password), comparisonHash.salt, comparisonHash.iterations);
    const matches = crypto.timingSafeEqual(comparisonHash.digest, computedDigest);
    return Boolean(parsedHash && matches);
  }

  function needsPasswordHashUpgrade(storedValue) {
    const parsedHash = parsePasswordHash(storedValue);
    return !parsedHash || parsedHash.iterations < CURRENT_PASSWORD_ITERATIONS;
  }

  function createJwtToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const now = Math.floor(Date.now() / 1000);
    const body = Buffer.from(
      JSON.stringify({
        ...payload,
        iat: now,
        exp: now + jwtExpiresInSeconds,
      })
    ).toString('base64url');

    const signature = crypto.createHmac('sha256', jwtSecret).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
  }

  function verifyJwtToken(token) {
    if (typeof token !== 'string' || token.length === 0 || token.length > MAX_JWT_LENGTH) {
      throw new Error('Invalid token format');
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [encodedHeader, body, signature] = parts;
    if (
      !parts.every((part) => /^[a-z0-9_-]+$/i.test(part)) ||
      Buffer.from(encodedHeader, 'base64url').toString('base64url') !== encodedHeader ||
      Buffer.from(body, 'base64url').toString('base64url') !== body ||
      Buffer.from(signature, 'base64url').toString('base64url') !== signature
    ) {
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
  }

  function getBearerToken(authorizationHeader = '') {
    if (typeof authorizationHeader !== 'string') {
      return '';
    }

    if (!authorizationHeader.startsWith('Bearer ')) {
      return '';
    }

    return authorizationHeader.slice('Bearer '.length).trim();
  }

  function authRequired(req, res, next) {
    try {
      const token = getBearerToken(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ error: 'Authorization token missing.' });
      }

      const payload = verifyJwtToken(token);
      req.auth = payload;
      return next();
    } catch (_error) {
      return res.status(401).json({ error: 'Invalid token.' });
    }
  }

  return {
    hashPassword,
    needsPasswordHashUpgrade,
    verifyPassword,
    createJwtToken,
    verifyJwtToken,
    getBearerToken,
    authRequired,
  };
}

module.exports = {
  createAuthHelpers,
};
