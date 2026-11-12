function createLimitInChatSearch({ inChatSearchRateLimit }) {
  return function limitInChatSearch(req, res, next) {
    if (String(req.query.query || '').trim()) {
      return inChatSearchRateLimit(req, res, next);
    }
    return next();
  };
}

module.exports = createLimitInChatSearch;
