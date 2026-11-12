const assert = require('node:assert/strict');
const test = require('node:test');
const { withServer, requestJson } = require('./http');
const { createThrottleFixture } = require('./login-throttle-fixture');

test('auth login route throttles repeated failed attempts', async () => {
  const {
    app,
  } = await createThrottleFixture();

  await withServer(app, async (server) => {
    for (let attempt = 1; attempt <= 11; attempt += 1) {
      const response = await requestJson(server, {
        method: 'POST',
        path: '/api/auth/login',
        body: {
          username: 'parikshit',
          password: 'wrong-password',
        },
      });

      assert.equal(response.status, attempt <= 10 ? 401 : 429);
    }
  });
});
