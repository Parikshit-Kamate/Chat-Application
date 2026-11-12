const config = require('./config');
const models = require('./runtime/models');
const { createAuthHelpers } = require('./lib/auth');
const { createRealtimeHelpers } = require('./lib/realtime');
const { registerChatSocketHandlers } = require('./sockets/register-chat-socket-handlers');
const authHelpers = createAuthHelpers({
  jwtSecret: config.JWT_SECRET,
  jwtExpiresInSeconds: config.JWT_EXPIRES_IN_SECONDS
});
const { app, io, server } = require('./runtime/http-server')(config, authHelpers);
const realtime = createRealtimeHelpers(io);
const chatService = require('./runtime/chat-service')({ io, models, realtime, config });
const services = { authHelpers, chatService, io, models, realtime, config };
require('./runtime/routes')(app, services);
registerChatSocketHandlers(services);
require('./runtime/error-handler')(app);
require('./runtime/database')(config, chatService);
server.listen(config.PORT, config.HOST, () => {
  console.log(`Server is running at http://${config.HOST}:${config.PORT}`);
});
