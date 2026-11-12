const { MAX_SEARCHABLE_CHATS } = require('./dependencies');

function createSearchMessages({ Chat, Message, escapeRegExp, serializeMessage }) {
  return async function searchMessages(req, res) {
    try {
      const userId = req.auth.sub;
      const query = String(req.query.query || '').trim();
      if (query.length < 2) {
        return res.json({ results: [] });
      }
      if (query.length > 200) {
        return res.status(400).json({ error: 'Search query is too long.' });
      }
      const chats = await Chat.find({ 'members.user': userId }).select('_id').limit(MAX_SEARCHABLE_CHATS);
      const chatIds = chats.map(chat => chat._id);
      const matchingMessages = await Message.find({
        chat: { $in: chatIds },
        text: { $regex: escapeRegExp(query), $options: 'i' }
      }).sort({ createdAt: -1 }).limit(40).populate('sender', 'username firstName lastName isOnline lastSeen').populate({
        path: 'replyTo',
        populate: [{ path: 'sender', select: 'username firstName lastName isOnline lastSeen' }]
      });
      return res.json({ results: matchingMessages.map(serializeMessage) });
    } catch (error) {
      console.error('Search error:', error);
      return res.status(500).json({ error: 'Unable to search messages.' });
    }
  };
}

module.exports = createSearchMessages;
