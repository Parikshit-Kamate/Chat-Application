function createSyncChatLastMessage({ Message, Chat }) {
  async function syncChatLastMessage(chat) {
    if (!chat?._id) {
      return;
    }
    const latestMessage = await Message.findOne({ chat: chat._id }).sort({ createdAt: -1 }).select('_id createdAt');
    await Chat.findByIdAndUpdate(chat._id, {
      $set: {
        lastMessage: latestMessage?._id || null,
        updatedAt: latestMessage?.createdAt || chat.createdAt || new Date()
      }
    });
  }
  return syncChatLastMessage;
}

module.exports = createSyncChatLastMessage;
