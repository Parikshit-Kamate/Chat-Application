const DEFAULT_MAX_KEYS = 10_000;
const MAX_KEY_LENGTH = 256;

function getRequestIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, MAX_KEY_LENGTH);
}

module.exports = getRequestIp;
