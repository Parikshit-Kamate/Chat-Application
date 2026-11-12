const { normalizeObjectId } = require('./dependencies');

function createMarkChatRead({ Chat, isChatMember, markMessagesSeen, emitStatusUpdates, emitUserEvent }) {
  return async function markChatRead(req, res) {
    try {
      const userId = req.auth.sub;
      const chatId = normalizeObjectId(req.params.chatId);
      if (!chatId) {
        return res.status(400).json({ error: 'Invalid chat ID.' });
      }
      const chat = await Chat.findById(chatId);
      if (!chat || !isChatMember(chat, userId)) {
        return res.status(404).json({ error: 'Chat not found.' });
      }
      const seenUpdates = await markMessagesSeen(chatId, userId);
      emitStatusUpdates(chatId, seenUpdates);
      emitUserEvent([userId], 'chat:list:refresh');
      return res.json({ seenCount: seenUpdates.length });
    } catch (error) {
      console.error('Mark read error:', error);
      return res.status(500).json({ error: 'Unable to mark messages as read.' });
    }
  };
}

module.exports = createMarkChatRead;
