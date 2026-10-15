const express = require('express');
const { createFixedWindowRateLimiter, getRequestIp } = require('../lib/rate-limit');

const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 12;
const MAX_CONCURRENT_PASSWORD_OPERATIONS = 4;

function createAuthRouter({ authHelpers, chatService, models }) {
  const router = express.Router();
  const { User } = models;
  const {
    authRequired,
    createJwtToken,
    hashPassword,
    needsPasswordHashUpgrade,
    verifyPassword,
  } = authHelpers;
  const { serializeUser } = chatService;
  let activePasswordOperations = 0;

  function acquirePasswordOperation(res) {
    if (activePasswordOperations >= MAX_CONCURRENT_PASSWORD_OPERATIONS) {
      res.status(503).json({ error: 'Authentication is busy. Please try again shortly.' });
      return false;
    }

    activePasswordOperations += 1;
    return true;
  }

  function releasePasswordOperation() {
    activePasswordOperations = Math.max(0, activePasswordOperations - 1);
  }

  const registerRateLimit = createFixedWindowRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxAttempts: 20,
    message: 'Too many registration attempts. Please try again later.',
    getKey: (req) => `register:${getRequestIp(req)}`,
  });

  const loginRateLimit = createFixedWindowRateLimiter({
    windowMs: 10 * 60 * 1000,
    maxAttempts: 10,
    message: 'Too many login attempts. Please try again later.',
    getKey: (req) => {
      const username = String(req.body?.username || '').trim().toLowerCase().slice(0, 30);
      return `login:${getRequestIp(req)}:${username || 'unknown'}`;
    },
  });

  const loginIpRateLimit = createFixedWindowRateLimiter({
    windowMs: 10 * 60 * 1000,
    maxAttempts: 50,
    message: 'Too many login attempts from this network. Please try again later.',
    getKey: (req) => `login-ip:${getRequestIp(req)}`,
  });

  router.post('/register', registerRateLimit, async (req, res) => {
    try {
      const firstName = String(req.body.firstName || '').trim();
      const lastName = String(req.body.lastName || '').trim();
      const username = String(req.body.username || '').trim();
      const password = String(req.body.password || '');

      if (firstName.length < 1 || firstName.length > 40) {
        return res.status(400).json({ error: 'First name must be between 1 and 40 characters.' });
      }

      if (lastName.length < 1 || lastName.length > 40) {
        return res.status(400).json({ error: 'Last name must be between 1 and 40 characters.' });
      }

      if (username.length < 2 || username.length > 30) {
        return res.status(400).json({ error: 'Username must be between 2 and 30 characters.' });
      }

      if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
        return res.status(400).json({
          error: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`,
        });
      }

      const usernameLower = username.toLowerCase();
      const existingUser = await User.findOne({ usernameLower });

      if (existingUser) {
        return res.status(409).json({ error: 'Username already exists.' });
      }

      if (!acquirePasswordOperation(res)) {
        return;
      }

      let passwordHash;
      try {
        passwordHash = await hashPassword(password);
      } finally {
        releasePasswordOperation();
      }

      const user = await User.create({
        firstName,
        lastName,
        username,
        usernameLower,
        passwordHash,
      });

      const token = createJwtToken({ sub: user._id.toString(), username: user.username });

      return res.status(201).json({
        token,
        user: serializeUser(user),
      });
    } catch (error) {
      console.error('Register error:', error);
      return res.status(500).json({ error: 'Registration failed.' });
    }
  });

  router.post('/login', loginIpRateLimit, loginRateLimit, async (req, res) => {
    try {
      const username = String(req.body.username || '').trim();
      const password = String(req.body.password || '');

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
      }

      if (username.length > 30 || password.length > MAX_PASSWORD_LENGTH) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      const user = await User.findOne({ usernameLower: username.toLowerCase() });
      if (!acquirePasswordOperation(res)) {
        return;
      }

      let passwordIsValid = false;
      try {
        passwordIsValid = await verifyPassword(password, user?.passwordHash || '');

        if (user && passwordIsValid && needsPasswordHashUpgrade(user.passwordHash) && typeof user.save === 'function') {
          user.passwordHash = await hashPassword(password);
          await user.save();
        }
      } finally {
        releasePasswordOperation();
      }

      if (!user || !passwordIsValid) {
        return res.status(401).json({ error: 'Invalid username or password.' });
      }

      const token = createJwtToken({ sub: user._id.toString(), username: user.username });

      return res.json({
        token,
        user: serializeUser(user),
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Login failed.' });
    }
  });

  router.get('/me', authRequired, async (req, res) => {
    try {
      const user = await User.findById(req.auth.sub).select('username firstName lastName isOnline lastSeen');
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      return res.json({ user: serializeUser(user) });
    } catch (error) {
      console.error('Auth me error:', error);
      return res.status(500).json({ error: 'Unable to fetch profile.' });
    }
  });

  return router;
}

module.exports = {
  createAuthRouter,
};
