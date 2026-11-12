const { normalizeObjectId } = require('./dependencies');

function createCreateDirectChat({
  User,
  findDirectChat,
  hasAcceptedFriendship,
  createOrReturnDirectChat,
  joinUserSocketsToChat,
  fetchChatByIdForUser,
  emitUserEvent
}) {
  return async function createDirectChat(req, res) {
    try {
      const userId = req.auth.sub;
      const targetUserId = normalizeObjectId(req.body.targetUserId);
      if (!targetUserId) {
        return res.status(400).json({ error: 'Invalid target user.' });
      }
      if (targetUserId === userId) {
        return res.status(400).json({ error: 'Cannot create a direct chat with yourself.' });
      }
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Target user not found.' });
      }
      let chat = await findDirectChat(userId, targetUserId);
      if (!chat) {
        const isFriend = await hasAcceptedFriendship(userId, targetUserId);
        if (!isFriend) {
          return res.status(403).json({ error: 'Send and accept a friend request before starting a chat.' });
        }
        chat = await createOrReturnDirectChat(userId, targetUserId);
      } else {
        joinUserSocketsToChat([userId, targetUserId], chat._id.toString());
      }
      const hydratedChat = await fetchChatByIdForUser(chat._id, userId);
      emitUserEvent([userId, targetUserId], 'chat:list:refresh');
      return res.status(201).json({ chat: hydratedChat });
    } catch (error) {
      console.error('Direct chat create error:', error);
      return res.status(500).json({ error: 'Unable to create direct chat.' });
    }
  };
}

module.exports = createCreateDirectChat;
