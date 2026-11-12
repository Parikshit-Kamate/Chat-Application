const { SOCKET_CONNECTION_RATE_LIMIT, SOCKET_EVENT_RATE_LIMITS } = require('./constants');

function consumeBucket(previous, config, now) {
  const elapsedSeconds = Math.max(0, now - previous.updatedAt) / 1000;
  const tokens = Math.min(config.capacity, previous.tokens + elapsedSeconds * config.refillPerSecond);
  const allowed = tokens >= 1;
  return {
    state: { tokens: allowed ? tokens - 1 : tokens, updatedAt: now },
    result: {
      allowed,
      retryAfterMs: allowed ? 0 : Math.max(1, Math.ceil(((1 - tokens) / config.refillPerSecond) * 1000)),
    },
  };
}

function createSocketRateLimiter() {
  const buckets = new Map();

  return (eventName) => {
    const config = SOCKET_EVENT_RATE_LIMITS[eventName];
    if (!config) {
      return { allowed: true, retryAfterMs: 0 };
    }

    const now = Date.now();
    const previous = buckets.get(config.bucket) || { tokens: config.capacity, updatedAt: now };
    const { state, result } = consumeBucket(previous, config, now);
    buckets.set(config.bucket, state);
    return result;
  };
}

function createConnectionRateLimiter() {
  let previous = { tokens: SOCKET_CONNECTION_RATE_LIMIT.capacity, updatedAt: Date.now() };

  return () => {
    const { state, result } = consumeBucket(previous, SOCKET_CONNECTION_RATE_LIMIT, Date.now());
    previous = state;
    return result;
  };
}

module.exports = { createSocketRateLimiter, createConnectionRateLimiter };
