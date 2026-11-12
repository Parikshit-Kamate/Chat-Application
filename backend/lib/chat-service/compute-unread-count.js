function createComputeUnreadCount({ Message }) {
  async function computeUnreadCount(chat, userId) {
    return Message.countDocuments({ chat: chat._id, sender: { $ne: userId }, seenBy: { $ne: userId } });
  }
  return computeUnreadCount;
}

module.exports = createComputeUnreadCount;
