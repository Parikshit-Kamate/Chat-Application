function createCurrentUser({ User, serializeUser }) {
  return async function currentUser(req, res) {
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
  };
}

module.exports = createCurrentUser;
