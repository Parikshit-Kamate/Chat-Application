const { normalizeObjectId } = require('../../lib/object-id');

function registerMessageStatusEvents(context, registerEvent) {
  const { userId, io, models: { Chat, Message }, chatService: { isChatMember, idList } } = context;

  function statusHandler(isSeen) {
    return async (payload = {}, callback = () => {}) => {
      const eventName = isSeen ? 'message:seen' : 'message:delivered';
      try {
        const chatId = normalizeObjectId(payload.chatId);
        const messageId = normalizeObjectId(payload.messageId);
        if (!chatId || !messageId) {
          callback({ error: 'Invalid payload.' });
          return;
        }
        const chat = await Chat.findById(chatId).select('_id members.user');
        if (!chat || !isChatMember(chat, userId)) {
          callback({ error: 'Chat not found.' });
          return;
        }
        const addToSet = isSeen ? { seenBy: userId, deliveredTo: userId } : { deliveredTo: userId };
        const message = await Message.findOneAndUpdate(
          { _id: messageId, chat: chatId },
          { $addToSet: addToSet },
          { new: true }
        );
        if (!message) {
          callback({ error: 'Message not found.' });
          return;
        }
        if (isSeen) {
          await Chat.updateOne(
            { _id: chatId, 'members.user': userId },
            { $set: { 'members.$.lastReadAt': new Date() } }
          );
        }
        io.to(`chat:${chatId}`).emit('message:status', {
          chatId,
          messageId,
          deliveredTo: idList(message.deliveredTo),
          seenBy: idList(message.seenBy),
        });
        if (isSeen) {
          io.to(`user:${userId}`).emit('chat:list:refresh');
        }
        callback({ ok: true });
      } catch (error) {
        console.error(`${eventName} error:`, error);
        callback({ error: isSeen ? 'Unable to update seen status.' : 'Unable to update delivery status.' });
      }
    };
  }

  registerEvent('message:delivered', statusHandler(false));
  registerEvent('message:seen', statusHandler(true));
}

module.exports = { registerMessageStatusEvents };
