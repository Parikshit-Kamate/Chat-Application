function createGetMessagePageSize({ DEFAULT_MESSAGE_PAGE_SIZE, MAX_MESSAGE_PAGE_SIZE }) {
  return function getMessagePageSize(value) {
    const requestedLimit = Number.parseInt(String(value || ''), 10);
    if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
      return DEFAULT_MESSAGE_PAGE_SIZE;
    }
    return Math.min(requestedLimit, MAX_MESSAGE_PAGE_SIZE);
  };
}

module.exports = createGetMessagePageSize;
