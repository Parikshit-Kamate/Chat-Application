const { MAX_USER_RATE_LIMITERS, USER_RATE_LIMITER_RETENTION_MS } = require('./constants');
const { createConnectionRateLimiter, createSocketRateLimiter } = require('./rate-limiter');

function createUserRateLimiters() {
  const records = new Map();

  function prune(now = Date.now()) {
    records.forEach((record, userId) => {
      if (record.expiresAt && record.expiresAt <= now) {
        records.delete(userId);
      }
    });

    while (records.size >= MAX_USER_RATE_LIMITERS) {
      const oldestUserId = records.keys().next().value;
      if (oldestUserId === undefined) {
        break;
      }
      records.delete(oldestUserId);
    }
  }

  function get(userId) {
    prune();
    const existingRecord = records.get(userId);
    if (existingRecord) {
      existingRecord.expiresAt = 0;
      return existingRecord;
    }

    const record = {
      consumeConnection: createConnectionRateLimiter(),
      consumeEvent: createSocketRateLimiter(),
      expiresAt: 0,
    };
    records.set(userId, record);
    return record;
  }

  function retain(userId) {
    const record = records.get(userId);
    if (record) {
      record.expiresAt = Date.now() + USER_RATE_LIMITER_RETENTION_MS;
    }
  }

  return { get, retain };
}

module.exports = { createUserRateLimiters };
