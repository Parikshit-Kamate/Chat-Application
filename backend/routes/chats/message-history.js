const { normalizeObjectId, MAX_MESSAGE_QUERY_LENGTH, MAX_CURSOR_LENGTH } = require('./dependencies');

function createMessageHistory({
  getMessagePageSize,
  decodeMessageCursor,
  Chat,
  isChatMember,
  escapeRegExp,
  Message,
  encodeMessageCursor,
  markMessagesDelivered,
  emitStatusUpdates,
  serializeMessage
}) {
  return async function messageHistory(req, res) {
    try {
      const userId = req.auth.sub;
      const chatId = normalizeObjectId(req.params.chatId);
      const query = String(req.query.query || '').trim();
      const pageSize = getMessagePageSize(req.query.limit);
      const cursor = String(req.query.cursor || '').trim();
      if (query.length > MAX_MESSAGE_QUERY_LENGTH) {
        return res.status(400).json({ error: 'Search query is too long.' });
      }
      if (cursor.length > MAX_CURSOR_LENGTH) {
        return res.status(400).json({ error: 'Invalid message cursor.' });
      }
      const decodedCursor = decodeMessageCursor(cursor);
      if (!chatId) {
        return res.status(400).json({ error: 'Invalid chat ID.' });
      }
      if (cursor && !decodedCursor) {
        return res.status(400).json({ error: 'Invalid message cursor.' });
      }
      const chat = await Chat.findById(chatId);
      if (!chat || !isChatMember(chat, userId)) {
        return res.status(404).json({ error: 'Chat not found.' });
      }
      const filters = { chat: chatId };
      if (query) {
        filters.text = { $regex: escapeRegExp(query), $options: 'i' };
      }
      if (decodedCursor) {
        filters.$or = [
          { createdAt: { $lt: decodedCursor.createdAt } },
          { createdAt: decodedCursor.createdAt, _id: { $lt: decodedCursor.id } }
        ];
      }
      const messages = await Message.find(filters)
        .sort({ createdAt: -1, _id: -1 })
        .limit(pageSize + 1)
        .populate('sender', 'username firstName lastName isOnline lastSeen')
        .populate({
        path: 'replyTo',
        populate: [{ path: 'sender', select: 'username firstName lastName isOnline lastSeen' }]
      });
      const hasMore = messages.length > pageSize;
      const pageMessages = messages.slice(0, pageSize);
      const displayMessages = [...pageMessages].reverse();
      const nextCursor = hasMore ? encodeMessageCursor(pageMessages[pageMessages.length - 1]) : '';
      if (!query && !decodedCursor) {
        const deliveredUpdates = await markMessagesDelivered(chatId, userId);
        emitStatusUpdates(chatId, deliveredUpdates);
      }
      return res.json({
        messages: displayMessages.map(serializeMessage),
        pageInfo: { hasMore, nextCursor, limit: pageSize }
      });
    } catch (error) {
      console.error('Messages fetch error:', error);
      return res.status(500).json({ error: 'Unable to fetch messages.' });
    }
  };
}

module.exports = createMessageHistory;
