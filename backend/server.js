const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');

const Message = require('./Chat/application');
const User = require('./Chat/user');
const Chat = require('./Chat/chat');
const FriendRequest = require('./Chat/friendRequest');
const UploadAsset = require('./Chat/uploadAsset');
const UploadQuota = require('./Chat/uploadQuota');
const config = require('./config');
const { createAuthHelpers } = require('./lib/auth');
const { createConcurrencyGate, createFixedWindowRateLimiter, getRequestIp } = require('./lib/rate-limit');
const { createRealtimeHelpers } = require('./lib/realtime');
const { createChatService } = require('./lib/chat-service');
const { createAuthRouter } = require('./routes/auth-routes');
const { createUsersRouter } = require('./routes/users-routes');
const { createFriendsRouter } = require('./routes/friends-routes');
const { createChatsRouter } = require('./routes/chats-routes');
const { createMessagesRouter } = require('./routes/messages-routes');
const { createUploadsRouter } = require('./routes/uploads-routes');
const { registerChatSocketHandlers } = require('./sockets/register-chat-socket-handlers');

const models = {
  Chat,
  FriendRequest,
  Message,
  UploadAsset,
  UploadQuota,
  User,
};

const authHelpers = createAuthHelpers({
  jwtSecret: config.JWT_SECRET,
  jwtExpiresInSeconds: config.JWT_EXPIRES_IN_SECONDS,
});

const uploadUserRateLimit = createFixedWindowRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 10,
  message: 'Too many upload requests. Please try again later.',
  getKey: (req) => `upload-user:${req.auth?.sub || 'anonymous'}`,
});
const uploadIpRateLimit = createFixedWindowRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxAttempts: 50,
  message: 'Too many upload requests from this network. Please try again later.',
  getKey: (req) => `upload-ip:${getRequestIp(req)}`,
});
const uploadConcurrencyGate = createConcurrencyGate({
  maxConcurrent: 2,
  message: 'Too many uploads in progress. Please wait and try again.',
  getKey: (req) => `upload-active:${req.auth?.sub || 'anonymous'}`,
});
const uploadGlobalConcurrencyGate = createConcurrencyGate({
  maxConcurrent: 8,
  message: 'Upload capacity is busy. Please wait and try again.',
  getKey: () => 'upload-active:global',
});
const MAX_UPLOAD_REQUEST_BYTES = 14 * 1024 * 1024;

function rejectOversizedUpload(req, res, next) {
  const contentLength = Number(req.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_REQUEST_BYTES) {
    return res.status(413).json({ error: 'Request payload is too large.' });
  }

  return next();
}

const corsOrigin = config.CLIENT_ORIGIN === '*' ? true : config.CLIENT_ORIGIN;
const app = express();

mongoose.set('bufferCommands', false);

app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");

  if (config.IS_PRODUCTION) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }

  next();
});

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
  })
);
app.use(
  '/api/uploads',
  authHelpers.authRequired,
  uploadUserRateLimit,
  uploadIpRateLimit,
  uploadGlobalConcurrencyGate,
  uploadConcurrencyGate,
  rejectOversizedUpload,
  express.json({ limit: '14mb' })
);
app.use(express.json({ limit: '128kb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'confabulate-chat',
    database: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable',
  });
});

function requireDatabaseConnection(_req, res, next) {
  if (mongoose.connection.readyState === 1) {
    return next();
  }

  return res.status(503).json({ error: 'Database temporarily unavailable.' });
}

const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 256 * 1024,
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    credentials: true,
  },
});

server.headersTimeout = 15_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;

const realtime = createRealtimeHelpers(io);
const chatService = createChatService({
  io,
  models,
  realtime,
  cloudinaryCloudName: config.CLOUDINARY_CLOUD_NAME,
  cloudinaryApiKey: config.CLOUDINARY_API_KEY,
  cloudinaryApiSecret: config.CLOUDINARY_API_SECRET,
  cloudinaryUploadPreset: config.CLOUDINARY_UPLOAD_PRESET,
  allowDataUrlFallback: config.ALLOW_DATA_URL_UPLOAD_FALLBACK,
  uploadLimits: {
    cleanupIntervalSeconds: config.UPLOAD_CLEANUP_INTERVAL_SECONDS,
    dailyMaxBytes: config.UPLOAD_DAILY_MAX_BYTES,
    dailyMaxFiles: config.UPLOAD_DAILY_MAX_FILES,
    pendingTtlSeconds: config.UPLOAD_PENDING_TTL_SECONDS,
    totalMaxBytes: config.UPLOAD_TOTAL_MAX_BYTES,
    totalMaxFiles: config.UPLOAD_TOTAL_MAX_FILES,
  },
});

app.use('/api/auth', requireDatabaseConnection, createAuthRouter({ authHelpers, chatService, models }));
app.use('/api/users', requireDatabaseConnection, createUsersRouter({ authHelpers, chatService, models }));
app.use('/api/friends', requireDatabaseConnection, createFriendsRouter({ authHelpers, chatService, models, realtime }));
app.use('/api', requireDatabaseConnection, createChatsRouter({ authHelpers, chatService, models, realtime }));
app.use('/api', requireDatabaseConnection, createMessagesRouter({ authHelpers, chatService, io, models, realtime }));
app.use(
  '/api',
  requireDatabaseConnection,
  createUploadsRouter({
    authHelpers,
    chatService,
    config: {
      cloudName: config.CLOUDINARY_CLOUD_NAME,
      apiKey: config.CLOUDINARY_API_KEY,
      apiSecret: config.CLOUDINARY_API_SECRET,
      allowDataUrlFallback: config.ALLOW_DATA_URL_UPLOAD_FALLBACK,
    },
  })
);

registerChatSocketHandlers({
  authHelpers,
  chatService,
  io,
  models,
  realtime,
});

app.use((error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Request payload is too large.' });
    return;
  }

  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    res.status(400).json({ error: 'Malformed JSON request.' });
    return;
  }

  console.error('Unhandled request error:', error);
  res.status(500).json({ error: 'Internal server error.' });
});

mongoose
  .connect(config.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => {
    console.log('Connected to MongoDB');

    const cleanupPendingUploads = () => {
      chatService.cleanupAbandonedUploads().catch((error) => {
        console.error('Unable to clean up pending uploads:', error.message);
      });
    };
    cleanupPendingUploads();
    const uploadCleanupTimer = setInterval(
      cleanupPendingUploads,
      config.UPLOAD_CLEANUP_INTERVAL_SECONDS * 1000
    );
    uploadCleanupTimer.unref();
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error.message);
  });

server.listen(config.PORT, config.HOST, () => {
  console.log(`Server is running at http://${config.HOST}:${config.PORT}`);
});
