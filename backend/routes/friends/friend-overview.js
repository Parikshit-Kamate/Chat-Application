function createFriendOverview({ fetchFriendOverview }) {
  return async function friendOverview(req, res) {
    try {
      const overview = await fetchFriendOverview(req.auth.sub);
      return res.json(overview);
    } catch (error) {
      console.error('Friends fetch error:', error);
      return res.status(500).json({ error: 'Unable to fetch friends.' });
    }
  };
}

module.exports = createFriendOverview;
