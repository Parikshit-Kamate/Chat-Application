function createFindDirectChat({ buildPairKey, Chat }) {
  async function findDirectChat(userId, targetUserId) {
    const pairKey = buildPairKey(userId, targetUserId);
    const keyedChat = await Chat.findOne({ type: 'direct', pairKey });
    if (keyedChat) {
      return keyedChat;
    }
    const legacyChat = await Chat.findOne({
      type: 'direct',
      'members.user': { $all: [userId, targetUserId] },
      $expr: { $eq: [{ $size: '$members' }, 2] }
    });
    if (!legacyChat) {
      return null;
    }
    try {
      await Chat.updateOne({ _id: legacyChat._id, pairKey: { $exists: false } }, { $set: { pairKey } });
      legacyChat.pairKey = pairKey;
      return legacyChat;
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
      return Chat.findOne({ type: 'direct', pairKey });
    }
  }
  return findDirectChat;
}

module.exports = createFindDirectChat;
