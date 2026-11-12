const DEFAULT_MAX_KEYS = 10_000;
const MAX_KEY_LENGTH = 256;

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

module.exports = createConcurrencyGate;
