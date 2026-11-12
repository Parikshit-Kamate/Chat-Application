const { objectId, query } = require('./query');
const { makeAuth, serializeUser } = require('./auth');
const { createJsonApp } = require('./http');
const { createAuthRouter } = require('../../routes/auth-routes');

async function createThrottleFixture() {
  const authHelpers = makeAuth();
  const user = {
    _id: objectId(),
    username: 'Parikshit',
    usernameLower: 'parikshit',
    passwordHash: await authHelpers.hashPassword('correct-password'),
    isOnline: false,
    lastSeen: null,
  };

  const User = {
    async findOne(filters) {
      return filters.usernameLower === user.usernameLower ? user : null;
    },
    findById(id) {
      return query(id === user._id ? user : null);
    },
  };

  const app = createJsonApp(
    '/api/auth',
    createAuthRouter({
      authHelpers,
      chatService: { serializeUser },
      models: { User },
    })
  );
  return {
    app,
  };
}

module.exports = { createThrottleFixture };
