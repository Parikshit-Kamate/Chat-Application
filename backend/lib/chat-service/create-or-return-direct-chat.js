const crypto = require('crypto');

function bindCreateOrReturnDirectChat({ findDirectChat, buildPairKey, Chat, realtime }) {
  async function createOrReturnDirectChat(userId, targetUserId) {
    let chat = await findDirectChat(userId, targetUserId);
    if (!chat) {
      const now = new Date();
      const pairKey = buildPairKey(userId, targetUserId);
      const directChatId = crypto.createHash('sha256').update(pairKey).digest('hex').slice(0, 24);
      try {
        chat = await Chat.findOneAndUpdate({ _id: directChatId, type: 'direct', pairKey }, {
          $setOnInsert: {
            type: 'direct',
            pairKey,
            members: [{ user: userId, lastReadAt: now }, { user: targetUserId, lastReadAt: new Date(0) }],
            admins: [userId],
            createdBy: userId
          }
        }, { new: true, setDefaultsOnInsert: true, upsert: true });
      } catch (error) {
        if (error?.code !== 11000) {
          throw error;
        }
        chat = await findDirectChat(userId, targetUserId);
      }
    }
    if (!chat) {
      throw new Error('Unable to create direct chat.');
    }
    realtime.joinUserSocketsToChat([userId, targetUserId], chat._id.toString());
    return chat;
  }
  return createOrReturnDirectChat;
}

module.exports = bindCreateOrReturnDirectChat;
