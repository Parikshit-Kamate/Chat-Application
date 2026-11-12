const { normalizeObjectId } = require('./dependencies');

function createDeleteMessage({
  Message,
  runChatOperationExclusive,
  deleteMessageOperation,
  scheduleAttachmentCleanup,
  io,
  emitUserEvent
}) {
  return async function deleteMessage(req, res) {
    try {
      const userId = req.auth.sub;
      const messageId = normalizeObjectId(req.params.messageId);
      if (!messageId) {
        return res.status(400).json({ error: 'Invalid message ID.' });
      }
      const initialMessage = await Message.findById(messageId).select('_id chat');
      if (!initialMessage) {
        return res.status(404).json({ error: 'Message not found.' });
      }
      const deleteResult = await runChatOperationExclusive(initialMessage.chat.toString(), () => deleteMessageOperation({
        messageId,
        userId
      }));
      if (deleteResult.error) {
        return res.status(deleteResult.status).json({ error: deleteResult.error });
      }
      const { chatId, memberIds } = deleteResult;
      scheduleAttachmentCleanup({ messageId, ownerId: userId });
      io.to(`chat:${chatId}`).emit('message:deleted', { chatId, messageId });
      emitUserEvent(memberIds, 'chat:list:refresh');
      return res.json({ ok: true, messageId, chatId });
    } catch (error) {
      console.error('Message delete error:', error);
      return res.status(500).json({ error: 'Unable to delete message.' });
    }
  };
}

module.exports = createDeleteMessage;
