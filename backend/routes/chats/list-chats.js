function createListChats({ fetchChatsForUser }) {
  return async function listChats(req, res) {
    try {
      const chats = await fetchChatsForUser(req.auth.sub);
      return res.json({ chats });
    } catch (error) {
      console.error('Chats fetch error:', error);
      return res.status(500).json({ error: 'Unable to fetch chats.' });
    }
  };
}

module.exports = createListChats;
