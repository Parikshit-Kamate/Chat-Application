const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');

module.exports = function createHttpServer(config, authHelpers) {
  const corsOrigin = config.CLIENT_ORIGIN === '*' ? true : config.CLIENT_ORIGIN;
  const app = express();
  mongoose.set('bufferCommands', false);
  require('./security-headers')(app, config);
  app.use(cors({ origin: corsOrigin, credentials: true }));
  require('./upload-middleware')(app, authHelpers);
  app.use(express.json({ limit: '128kb' }));
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'confabulate-chat',
      database: mongoose.connection.readyState === 1 ? 'connected' : 'unavailable'
    });
  });
  const server = http.createServer(app);
  const io = new Server(server, {
    maxHttpBufferSize: 256 * 1024,
    cors: { origin: corsOrigin, methods: ['GET', 'POST', 'PATCH', 'DELETE'], credentials: true }
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;
  return { app, io, server };
};
