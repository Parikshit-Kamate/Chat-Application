const { CLIENT_MESSAGE_ID_PATTERN } = require('./constants');

function normalizeSocketPayload(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null ? value : {};
}

function findAcknowledgement(args) {
  for (let index = args.length - 1; index >= 0; index -= 1) {
    if (typeof args[index] === 'function') {
      return args[index];
    }
  }

  return null;
}

function createSafeAcknowledgement(candidate) {
  let acknowledged = false;

  return (payload) => {
    if (acknowledged || typeof candidate !== 'function') {
      return;
    }

    acknowledged = true;

    try {
      candidate(payload);
    } catch (error) {
      console.error('Socket acknowledgement error:', error);
    }
  };
}

function normalizeClientMessageId(value) {
  const clientMessageId = typeof value === 'string' ? value.trim() : '';
  return CLIENT_MESSAGE_ID_PATTERN.test(clientMessageId) ? clientMessageId : '';
}

module.exports = {
  normalizeSocketPayload,
  findAcknowledgement,
  createSafeAcknowledgement,
  normalizeClientMessageId,
};
