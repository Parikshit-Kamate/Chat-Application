const { normalizeObjectId } = require('./dependencies');

function createRemoveGroupMember({
  runChatOperationExclusive,
  removeMemberOperation,
  emitUserEvent,
  fetchChatByIdForUser
}) {
  return async function removeGroupMember(req, res) {
    try {
      const userId = req.auth.sub;
      const chatId = normalizeObjectId(req.params.chatId);
      const targetMemberId = normalizeObjectId(req.params.memberId);
      if (!chatId || !targetMemberId) {
        return res.status(400).json({ error: 'Invalid chat or member ID.' });
      }
      const removalResult = await runChatOperationExclusive(chatId, () => removeMemberOperation({
        chatId,
        userId,
        targetMemberId
      }));
      if (removalResult.error) {
        return res.status(removalResult.status).json({ error: removalResult.error });
      }
      emitUserEvent(removalResult.currentMemberIds, 'chat:list:refresh');
      const hydratedChat = removalResult.isSelfRemoval ? null : await fetchChatByIdForUser(removalResult.chat._id, userId);
      return res.json({ chat: hydratedChat, removedMemberId: targetMemberId });
    } catch (error) {
      console.error('Group remove member error:', error);
      return res.status(500).json({ error: 'Unable to remove group member.' });
    }
  };
}

module.exports = createRemoveGroupMember;
