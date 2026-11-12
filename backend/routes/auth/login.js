const { MAX_PASSWORD_LENGTH } = require('./dependencies');

function createLogin({
  User,
  acquirePasswordOperation,
  verifyPassword,
  needsPasswordHashUpgrade,
  hashPassword,
  releasePasswordOperation,
  createJwtToken,
  serializeUser
}) {
  return async function login(req, res) {
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
      return res.json({ token, user: serializeUser(user) });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Login failed.' });
    }
  };
}

module.exports = createLogin;
