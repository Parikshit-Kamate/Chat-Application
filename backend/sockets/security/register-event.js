const { AUTH_EXPIRED_RESPONSE, RATE_LIMITED_RESPONSE, SOCKET_EVENT_ERROR_MESSAGES } = require('./constants');
const { normalizeSocketPayload, findAcknowledgement, createSafeAcknowledgement } = require('./payload');
const { createSocketRateLimiter } = require('./rate-limiter');

function createEventRegistrar(socket, authentication, consumeUserEventToken) {
  const consumeEventToken = createSocketRateLimiter();

  return (eventName, handler) => {
    socket.on(eventName, (...args) => {
      const payload = normalizeSocketPayload(args[0]);
      const acknowledge = createSafeAcknowledgement(findAcknowledgement(args));

      if (authentication.isExpired()) {
        acknowledge(AUTH_EXPIRED_RESPONSE);
        authentication.disconnect();
        return Promise.resolve();
      }

      const socketRateLimit = consumeEventToken(eventName);
      const rateLimit = socketRateLimit.allowed ? consumeUserEventToken(eventName) : socketRateLimit;
      if (!rateLimit.allowed) {
        acknowledge({ ...RATE_LIMITED_RESPONSE, retryAfterMs: rateLimit.retryAfterMs });
        return Promise.resolve();
      }

      const handleFailure = (error) => {
        console.error(`${eventName} error:`, error);
        acknowledge({
          error: SOCKET_EVENT_ERROR_MESSAGES[eventName] || 'Unable to process realtime request.',
        });
      };

      try {
        return Promise.resolve(handler(payload, acknowledge)).catch(handleFailure);
      } catch (error) {
        handleFailure(error);
        return Promise.resolve();
      }
    });
  };
}

module.exports = { createEventRegistrar };
