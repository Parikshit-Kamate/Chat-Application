const { normalizeObjectId } = require('../../lib/object-id');

function registerTypingEvents(context, registerEvent) {
  const { socket, userId, username, models: { Chat }, chatService: { isChatMember } } = context;

  function typingHandler(isTyping) {
    return async (payload = {}) => {
      const chatId = normalizeObjectId(payload.chatId);
      if (!chatId) {
        return;
      }
      const chat = await Chat.findById(chatId).select('_id members.user');
      if (!chat || !isChatMember(chat, userId)) {
        return;
      }
      socket.to(`chat:${chatId}`).emit('typing:update', { chatId, userId, username, isTyping });
    };
  }

  registerEvent('typing:start', typingHandler(true));
  registerEvent('typing:stop', typingHandler(false));
}

module.exports = { registerTypingEvents };
