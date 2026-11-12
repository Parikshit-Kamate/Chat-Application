const assert = require('node:assert/strict');
const test = require('node:test');
const { withServer, requestJson } = require('./http');
const { createRegistrationFixture } = require('./auth-registration-fixture');

test('auth routes register users and then login with the stored password hash', async () => {
  const {
    app,
    authHelpers,
    users,
  } = await createRegistrationFixture();

  await withServer(app, async (server) => {
    const registerResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/register',
      body: {
        firstName: 'Parikshit',
        lastName: 'Singh',
        username: 'Parikshit',
        password: 'correct-password',
      },
    });

    assert.equal(registerResponse.status, 201);
    assert.equal(registerResponse.body.user.username, 'Parikshit');
    assert.equal(registerResponse.body.user.firstName, 'Parikshit');
    assert.equal(registerResponse.body.user.lastName, 'Singh');
    assert.equal(typeof registerResponse.body.token, 'string');
    assert.notEqual(users[0].passwordHash, 'correct-password');

    const loginResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        username: 'parikshit',
        password: 'correct-password',
      },
    });

    assert.equal(loginResponse.status, 200);
    assert.equal(loginResponse.body.user.id, users[0]._id);

    const invalidLoginResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        username: 'parikshit',
        password: 'wrong-password',
      },
    });

    assert.equal(invalidLoginResponse.status, 401);
  });
});
