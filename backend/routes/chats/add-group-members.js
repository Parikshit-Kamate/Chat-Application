const { normalizeObjectId, MAX_GROUP_MEMBERS } = require('./dependencies');

function createAddGroupMembers({
  runChatOperationExclusive,
  addMembersOperation,
  emitUserEvent,
  fetchChatByIdForUser
}) {
  return async function addGroupMembers(req, res) {
    try {
      const userId = req.auth.sub;
      const chatId = normalizeObjectId(req.params.chatId);
      const requestedMemberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds.map(normalizeObjectId) : [];
      if (!chatId) {
        return res.status(400).json({ error: 'Invalid chat ID.' });
      }
      if (requestedMemberIds.length === 0) {
        return res.status(400).json({ error: 'Select at least one member to add.' });
      }
      if (requestedMemberIds.length > MAX_GROUP_MEMBERS) {
        return res.status(400).json({ error: `Groups can contain at most ${MAX_GROUP_MEMBERS} members.` });
      }
      if (requestedMemberIds.some(memberId => !memberId)) {
        return res.status(400).json({ error: 'One or more selected members are invalid.' });
      }
      const additionResult = await runChatOperationExclusive(chatId, () => addMembersOperation({
        chatId,
        userId,
        requestedMemberIds
      }));
      if (additionResult.error) {
        return res.status(additionResult.status).json({ error: additionResult.error });
      }
      const { chat, memberIdsToAdd, refreshedMemberIds } = additionResult;
      emitUserEvent(refreshedMemberIds, 'chat:list:refresh');
      const hydratedChat = await fetchChatByIdForUser(chat._id, userId);
      return res.status(201).json({ chat: hydratedChat, addedMemberIds: memberIdsToAdd });
    } catch (error) {
      console.error('Group add members error:', error);
      return res.status(500).json({ error: 'Unable to add group members.' });
    }
  };
}

module.exports = createAddGroupMembers;
