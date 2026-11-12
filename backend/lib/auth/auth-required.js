function createAuthRequired({ getBearerToken, verifyJwtToken }) {
  return function authRequired(req, res, next) {
    try {
      const token = getBearerToken(req.headers.authorization);
      if (!token) {
        return res.status(401).json({ error: 'Authorization token missing.' });
      }
      const payload = verifyJwtToken(token);
      req.auth = payload;
      return next();
    } catch (_error) {
      return res.status(401).json({ error: 'Invalid token.' });
    }
  };
}

module.exports = createAuthRequired;
