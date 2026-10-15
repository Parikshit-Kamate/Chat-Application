const express = require('express');
const { createFixedWindowRateLimiter } = require('../lib/rate-limit');

function createUsersRouter({ authHelpers, chatService, models }) {
  const router = express.Router();
  const { User } = models;
  const { authRequired } = authHelpers;
  const { escapeRegExp, serializeUser } = chatService;
  const userSearchRateLimit = createFixedWindowRateLimiter({
    windowMs: 60 * 1000,
    maxAttempts: 60,
    message: 'Too many user searches. Please try again later.',
    getKey: (req) => `user-search:${req.auth?.sub || 'unknown'}`,
  });

  router.get('/', authRequired, userSearchRateLimit, async (req, res) => {
    try {
      const userId = req.auth.sub;
      const query = String(req.query.query || '').trim();

      if (query.length > 100) {
        return res.status(400).json({ error: 'Search query is too long.' });
      }

      const filters = {
        _id: { $ne: userId },
      };

      if (query) {
        filters.usernameLower = { $regex: `^${escapeRegExp(query.toLowerCase())}` };
      }

      const users = await User.find(filters)
        .sort({ username: 1 })
        .limit(60)
        .select('username firstName lastName');

      return res.json({
        users: users.map((user) => serializeUser(user, { includePresence: false })),
      });
    } catch (error) {
      console.error('Users fetch error:', error);
      return res.status(500).json({ error: 'Unable to fetch users.' });
    }
  });

  return router;
}

module.exports = {
  createUsersRouter,
};
