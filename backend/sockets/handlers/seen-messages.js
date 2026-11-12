const { normalizeObjectId } = require('../../lib/object-id');

function registerSeenMessagesEvent(context, registerEvent) {
  const { userId, io, models: { Chat }, chatService: { isChatMember, markMessagesSeen } } = context;

  registerEvent('messages:mark_seen', async (payload = {}, callback = () => {}) => {
    try {
      const chatId = normalizeObjectId(payload.chatId);
      if (!chatId) {
        callback({ error: 'Invalid chat ID.' });
        return;
      }
      const chat = await Chat.findById(chatId).select('_id members.user');
      if (!chat || !isChatMember(chat, userId)) {
        callback({ error: 'Chat not found.' });
        return;
      }
      const seenUpdates = await markMessagesSeen(chatId, userId);
      seenUpdates.forEach((status) => {
        io.to(`chat:${chatId}`).emit('message:status', status);
      });
      io.to(`user:${userId}`).emit('chat:list:refresh');
      callback({ ok: true, count: seenUpdates.length });
    } catch (error) {
      console.error('messages:mark_seen error:', error);
      callback({ error: 'Unable to mark messages as seen.' });
    }
  });
}

module.exports = { registerSeenMessagesEvent };
