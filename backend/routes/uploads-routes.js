const express = require('express');
const createContext = require('./uploads/context');

function createUploadsRouter(options) {
  const router = express.Router();
  const context = createContext(options);
  const { authRequired } = context;
  router.post('/uploads', authRequired, require('./uploads/upload-file')(context));
  router.get('/uploads/:uploadId/content', authRequired,
    ...require('./uploads/download-limits')(), require('./uploads/download-file')(options));
  return router;
}

module.exports = { createUploadsRouter };
