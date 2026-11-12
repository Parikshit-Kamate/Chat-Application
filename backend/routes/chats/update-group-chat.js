const { normalizeObjectId } = require('./dependencies');

function createUpdateGroupChat({
  runChatOperationExclusive,
  updateGroupOperation,
  emitUserEvent,
  fetchChatByIdForUser
}) {
  return async function updateGroupChat(req, res) {
    try {
      const userId = req.auth.sub;
      const chatId = normalizeObjectId(req.params.chatId);
      if (!chatId) {
        return res.status(400).json({ error: 'Invalid chat ID.' });
      }
      const updateResult = await runChatOperationExclusive(chatId, () => updateGroupOperation({
        chatId,
        userId,
        req
      }));
      if (updateResult.error) {
        return res.status(updateResult.status).json({ error: updateResult.error });
      }
      const { chat, memberIds } = updateResult;
      emitUserEvent(memberIds, 'chat:list:refresh');
      const hydratedChat = await fetchChatByIdForUser(chat._id, userId);
      return res.json({ chat: hydratedChat });
    } catch (error) {
      console.error('Group update error:', error);
      return res.status(500).json({ error: 'Unable to update chat.' });
    }
  };
}

module.exports = createUpdateGroupChat;
