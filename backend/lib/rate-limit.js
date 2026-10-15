const DEFAULT_MAX_KEYS = 10_000;
const MAX_KEY_LENGTH = 256;

function getRequestIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, MAX_KEY_LENGTH);
}

function createFixedWindowRateLimiter({
  getKey,
  maxAttempts,
  message,
  windowMs,
  maxKeys = DEFAULT_MAX_KEYS,
}) {
  if (typeof getKey !== 'function') {
    throw new TypeError('getKey must be a function.');
  }

  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError('maxAttempts must be a positive integer.');
  }

  if (!Number.isSafeInteger(windowMs) || windowMs < 1) {
    throw new TypeError('windowMs must be a positive integer.');
  }

  const attemptsByKey = new Map();
  let nextCleanupAt = 0;

  function cleanup(now) {
    if (now < nextCleanupAt && attemptsByKey.size < maxKeys) {
      return;
    }

    attemptsByKey.forEach((record, key) => {
      if (record.resetAt <= now) {
        attemptsByKey.delete(key);
      }
    });

    while (attemptsByKey.size >= maxKeys) {
      const oldestKey = attemptsByKey.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      attemptsByKey.delete(oldestKey);
    }

    nextCleanupAt = now + Math.min(windowMs, 60_000);
  }

  return (req, res, next) => {
    const now = Date.now();
    cleanup(now);

    const rawKey = getKey(req);
    const key = String(rawKey || 'unknown').slice(0, MAX_KEY_LENGTH);
    const record = attemptsByKey.get(key);

    if (!record || record.resetAt <= now) {
      attemptsByKey.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    record.count += 1;

    if (record.count > maxAttempts) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((record.resetAt - now) / 1000))));
      return res.status(429).json({ error: message });
    }

    return next();
  };
}

function createConcurrencyGate({ getKey, maxConcurrent, message }) {
  if (typeof getKey !== 'function') {
    throw new TypeError('getKey must be a function.');
  }

  if (!Number.isSafeInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new TypeError('maxConcurrent must be a positive integer.');
  }

  const activeByKey = new Map();

  return (req, res, next) => {
    const key = String(getKey(req) || 'unknown').slice(0, MAX_KEY_LENGTH);
    const activeCount = activeByKey.get(key) || 0;
    if (activeCount >= maxConcurrent) {
      return res.status(429).json({ error: message });
    }

    activeByKey.set(key, activeCount + 1);
    let released = false;
    const release = () => {
      if (released) {
        return;
      }
      released = true;

      const remaining = Math.max(0, (activeByKey.get(key) || 1) - 1);
      if (remaining === 0) {
        activeByKey.delete(key);
      } else {
        activeByKey.set(key, remaining);
      }
    };

    res.once('finish', release);
    res.once('close', release);
    return next();
  };
}

module.exports = {
  createConcurrencyGate,
  createFixedWindowRateLimiter,
  getRequestIp,
};
