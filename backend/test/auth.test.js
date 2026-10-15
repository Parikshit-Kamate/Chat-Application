const assert = require('node:assert/strict');
const test = require('node:test');
const { createAuthHelpers } = require('../lib/auth');

test('hashPassword creates verifiable salted password hashes', async () => {
  const auth = createAuthHelpers({
    jwtSecret: 'test-secret',
    jwtExpiresInSeconds: 60,
  });

  const firstHash = await auth.hashPassword('correct-password');
  const secondHash = await auth.hashPassword('correct-password');

  assert.notEqual(firstHash, secondHash);
  assert.equal(await auth.verifyPassword('correct-password', firstHash), true);
  assert.equal(await auth.verifyPassword('wrong-password', firstHash), false);
  assert.equal(auth.needsPasswordHashUpgrade(firstHash), false);
});

test('createJwtToken and verifyJwtToken round-trip signed payloads', () => {
  const auth = createAuthHelpers({
    jwtSecret: 'test-secret',
    jwtExpiresInSeconds: 60,
  });

  const token = auth.createJwtToken({
    sub: '64b000000000000000000001',
    username: 'parikshit',
  });

  const payload = auth.verifyJwtToken(token);

  assert.equal(payload.sub, '64b000000000000000000001');
  assert.equal(payload.username, 'parikshit');
  assert.equal(typeof payload.iat, 'number');
  assert.equal(typeof payload.exp, 'number');
});

test('verifyJwtToken rejects tampered tokens', () => {
  const auth = createAuthHelpers({
    jwtSecret: 'test-secret',
    jwtExpiresInSeconds: 60,
  });

  const token = auth.createJwtToken({ sub: '64b000000000000000000001' });
  const tamperedToken = token.replace(/\.[^.]+$/, '.invalid-signature');

  assert.throws(() => auth.verifyJwtToken(tamperedToken), /Invalid (signature|token encoding)/);
});

test('verifyJwtToken rejects missing or invalid expiry claims', () => {
  const auth = createAuthHelpers({
    jwtSecret: 'test-secret',
    jwtExpiresInSeconds: Number.NaN,
  });
  const token = auth.createJwtToken({ sub: '64b000000000000000000001' });

  assert.throws(() => auth.verifyJwtToken(token), /Invalid token timestamps/);
});
