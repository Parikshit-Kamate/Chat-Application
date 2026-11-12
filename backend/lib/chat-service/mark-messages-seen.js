const { MAX_STATUS_UPDATE_EVENTS } = require('./constants');

function createMarkMessagesSeen({ Chat, Message, idList }) {
  async function markMessagesSeen(chatId, userId) {
    const seenAt = new Date();
    await Chat.updateOne({ _id: chatId, 'members.user': userId }, { $set: { 'members.$.lastReadAt': seenAt } });
    const unseenMessages = await Message.find({
      chat: chatId,
      sender: { $ne: userId },
      seenBy: { $ne: userId }
    }).sort({ createdAt: -1, _id: -1 }).limit(MAX_STATUS_UPDATE_EVENTS).select('_id deliveredTo seenBy');
    if (unseenMessages.length === 0) {
      return [];
    }
    await Message.updateMany({
      _id: {
        $in: unseenMessages.map(message => message._id)
      },
      chat: chatId,
      sender: { $ne: userId },
      seenBy: { $ne: userId }
    }, { $addToSet: { seenBy: userId, deliveredTo: userId } });
    return unseenMessages.map(message => ({
      chatId: chatId.toString(),
      messageId: message._id.toString(),
      deliveredTo: Array.from(new Set([...idList(message.deliveredTo), userId])),
      seenBy: Array.from(new Set([...idList(message.seenBy), userId]))
    }));
  }
  return markMessagesSeen;
}

module.exports = createMarkMessagesSeen;
