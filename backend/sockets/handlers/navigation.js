const { normalizeObjectId } = require('../../lib/object-id');

function registerNavigationEvents(context, registerEvent) {
  const { socket, userId, io, joinSocketToChat, models: { Chat }, chatService } = context;
  const { isChatMember, markMessagesDelivered, markMessagesSeen } = chatService;

  registerEvent('chat:open', async (payload = {}, callback = () => {}) => {
    try {
      const chatId = normalizeObjectId(payload.chatId);
      if (!chatId) {
        callback({ error: 'Invalid chat ID.' });
        return;
      }
      const chat = await Chat.findById(chatId);
      if (!chat || !isChatMember(chat, userId)) {
        callback({ error: 'Chat not found.' });
        return;
      }
      socket.data.activeChatId = chatId;
      if (!joinSocketToChat(socket, chatId)) {
        socket.data.activeChatId = null;
        callback({ error: 'Chat not found.' });
        return;
      }
      const deliveredUpdates = await markMessagesDelivered(chatId, userId);
      const seenUpdates = await markMessagesSeen(chatId, userId);
      deliveredUpdates.forEach((status) => {
        io.to(`chat:${chatId}`).emit('message:status', status);
      });
      seenUpdates.forEach((status) => {
        io.to(`chat:${chatId}`).emit('message:status', status);
      });
      io.to(`user:${userId}`).emit('chat:list:refresh');
      callback({ ok: true });
    } catch (error) {
      console.error('chat:open error:', error);
      callback({ error: 'Unable to open chat.' });
    }
  });

  registerEvent('chat:close', (payload = {}) => {
    const chatId = normalizeObjectId(payload.chatId);
    if (socket.data.activeChatId === chatId) {
      socket.data.activeChatId = null;
    }
  });
}

module.exports = { registerNavigationEvents };
