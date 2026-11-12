const mongoose = require('mongoose');
const { createAuthRouter } = require('../routes/auth-routes');
const { createUsersRouter } = require('../routes/users-routes');
const { createFriendsRouter } = require('../routes/friends-routes');
const { createChatsRouter } = require('../routes/chats-routes');
const { createMessagesRouter } = require('../routes/messages-routes');
const { createUploadsRouter } = require('../routes/uploads-routes');

function requireDatabaseConnection(_req, res, next) {
  if (mongoose.connection.readyState === 1) {
    return next();
  }
  return res.status(503).json({ error: 'Database temporarily unavailable.' });
}

module.exports = function mountRoutes(app, { authHelpers, chatService, models, realtime, io, config }) {
  app.use('/api/auth', requireDatabaseConnection, createAuthRouter({ authHelpers, chatService, models }));
  app.use('/api/users', requireDatabaseConnection, createUsersRouter({ authHelpers, chatService, models }));
  app.use('/api/friends', requireDatabaseConnection, createFriendsRouter({
    authHelpers,
    chatService,
    models,
    realtime
  }));
  app.use('/api', requireDatabaseConnection, createChatsRouter({ authHelpers, chatService, models, realtime }));
  app.use('/api', requireDatabaseConnection, createMessagesRouter({
    authHelpers,
    chatService,
    io,
    models,
    realtime
  }));
  app.use('/api', requireDatabaseConnection, createUploadsRouter({
    authHelpers,
    chatService,
    models,
    config: {
      cloudName: config.CLOUDINARY_CLOUD_NAME,
      apiKey: config.CLOUDINARY_API_KEY,
      apiSecret: config.CLOUDINARY_API_SECRET,
      allowDataUrlFallback: config.ALLOW_DATA_URL_UPLOAD_FALLBACK
    }
  }));
};
