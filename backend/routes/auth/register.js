const { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH } = require('./dependencies');

function createRegister({
  User,
  acquirePasswordOperation,
  hashPassword,
  releasePasswordOperation,
  createJwtToken,
  serializeUser
}) {
  return async function register(req, res) {
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
          error: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters.`
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
      const user = await User.create({ firstName, lastName, username, usernameLower, passwordHash });
      const token = createJwtToken({ sub: user._id.toString(), username: user.username });
      return res.status(201).json({ token, user: serializeUser(user) });
    } catch (error) {
      console.error('Register error:', error);
      return res.status(500).json({ error: 'Registration failed.' });
    }
  };
}

module.exports = createRegister;
