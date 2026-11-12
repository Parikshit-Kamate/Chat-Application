const express = require('express');
const { createConcurrencyGate, createFixedWindowRateLimiter, getRequestIp } = require('../lib/rate-limit');

module.exports = function installUploadMiddleware(app, authHelpers) {
  const uploadUserRateLimit = createFixedWindowRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxAttempts: 10,
    message: 'Too many upload requests. Please try again later.',
    getKey: req => `upload-user:${req.auth?.sub || 'anonymous'}`
  });
  const uploadIpRateLimit = createFixedWindowRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxAttempts: 50,
    message: 'Too many upload requests from this network. Please try again later.',
    getKey: req => `upload-ip:${getRequestIp(req)}`
  });
  const uploadConcurrencyGate = createConcurrencyGate({
    maxConcurrent: 2,
    message: 'Too many uploads in progress. Please wait and try again.',
    getKey: req => `upload-active:${req.auth?.sub || 'anonymous'}`
  });
  const uploadGlobalConcurrencyGate = createConcurrencyGate({
    maxConcurrent: 8,
    message: 'Upload capacity is busy. Please wait and try again.',
    getKey: () => 'upload-active:global'
  });
  const MAX_UPLOAD_REQUEST_BYTES = 14 * 1024 * 1024;
  function rejectOversizedUpload(req, res, next) {
    const contentLength = Number(req.headers['content-length']);
    if (Number.isFinite(contentLength) && contentLength > MAX_UPLOAD_REQUEST_BYTES) {
      return res.status(413).json({ error: 'Request payload is too large.' });
    }
    return next();
  }
  app.post(
    '/api/uploads',
    authHelpers.authRequired,
    uploadUserRateLimit,
    uploadIpRateLimit,
    uploadGlobalConcurrencyGate,
    uploadConcurrencyGate,
    rejectOversizedUpload,
    express.json({
      limit: '14mb'
    })
  );
};
