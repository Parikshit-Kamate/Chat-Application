const { createConcurrencyGate, createFixedWindowRateLimiter } = require('../../lib/rate-limit');

function createDownloadLimits() {
  const userLimit = createFixedWindowRateLimiter({
    windowMs: 60_000, maxAttempts: 120,
    getKey: req => `download:${req.auth.sub}`, message: 'Too many attachment requests.'
  });
  const userGate = createConcurrencyGate({
    maxConcurrent: 4, getKey: req => req.auth.sub,
    message: 'Too many attachment downloads in progress.'
  });
  const globalGate = createConcurrencyGate({
    maxConcurrent: 8, getKey: () => 'downloads',
    message: 'Attachment download capacity is busy.'
  });
  return [userLimit, userGate, globalGate];
}

module.exports = createDownloadLimits;
