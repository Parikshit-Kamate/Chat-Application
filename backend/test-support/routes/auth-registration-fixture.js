const { objectId, query } = require('./query');
const { makeAuth, serializeUser } = require('./auth');
const { createJsonApp } = require('./http');
const { createAuthRouter } = require('../../routes/auth-routes');

async function createRegistrationFixture() {
  const authHelpers = makeAuth();
  const users = [];

  const User = {
    async findOne(filters) {
      return users.find((user) => user.usernameLower === filters.usernameLower) || null;
    },
    async create(data) {
      const user = {
        _id: objectId(),
        ...data,
        isOnline: false,
        lastSeen: null,
      };
      users.push(user);
      return user;
    },
    findById(id) {
      return query(users.find((user) => user._id === id) || null);
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
    authHelpers,
    users,
  };
}

module.exports = { createRegistrationFixture };
