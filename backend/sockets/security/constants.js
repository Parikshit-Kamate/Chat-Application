const MAX_AUTH_TIMER_DELAY_MS = 2_147_483_647;
const MAX_SOCKETS_PER_USER = 8;
const MAX_USER_RATE_LIMITERS = 10_000;
const USER_RATE_LIMITER_RETENTION_MS = 5 * 60 * 1000;
const CLIENT_MESSAGE_ID_PATTERN = /^[a-z0-9_-]{16,64}$/i;
const SOCKET_CONNECTION_RATE_LIMIT = { capacity: 12, refillPerSecond: 0.1 };
const AUTH_EXPIRED_RESPONSE = {
  error: 'Authentication token expired.',
  code: 'AUTH_EXPIRED',
};
const RATE_LIMITED_RESPONSE = {
  error: 'Too many realtime requests. Please slow down.',
  code: 'RATE_LIMITED',
};
const SOCKET_EVENT_RATE_LIMITS = {
  'chat:open': { bucket: 'chat-navigation', capacity: 12, refillPerSecond: 0.5 },
  'chat:close': { bucket: 'chat-navigation', capacity: 12, refillPerSecond: 0.5 },
  'typing:start': { bucket: 'typing', capacity: 20, refillPerSecond: 3 },
  'typing:stop': { bucket: 'typing', capacity: 20, refillPerSecond: 3 },
  'messages:mark_seen': { bucket: 'message-status', capacity: 40, refillPerSecond: 2 },
  'message:delivered': { bucket: 'message-status', capacity: 40, refillPerSecond: 2 },
  'message:seen': { bucket: 'message-status', capacity: 40, refillPerSecond: 2 },
  'message:send': { bucket: 'message-send', capacity: 10, refillPerSecond: 0.5 },
};
const SOCKET_EVENT_ERROR_MESSAGES = {
  'chat:open': 'Unable to open chat.',
  'chat:close': 'Unable to close chat.',
  'typing:start': 'Unable to update typing status.',
  'typing:stop': 'Unable to update typing status.',
  'messages:mark_seen': 'Unable to mark messages as seen.',
  'message:delivered': 'Unable to update delivery status.',
  'message:seen': 'Unable to update seen status.',
  'message:send': 'Unable to send message.',
};

module.exports = {
  MAX_AUTH_TIMER_DELAY_MS,
  MAX_SOCKETS_PER_USER,
  MAX_USER_RATE_LIMITERS,
  USER_RATE_LIMITER_RETENTION_MS,
  CLIENT_MESSAGE_ID_PATTERN,
  SOCKET_CONNECTION_RATE_LIMIT,
  AUTH_EXPIRED_RESPONSE,
  RATE_LIMITED_RESPONSE,
  SOCKET_EVENT_RATE_LIMITS,
  SOCKET_EVENT_ERROR_MESSAGES,
};
