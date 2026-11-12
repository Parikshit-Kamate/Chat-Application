const { MAX_STATUS_UPDATE_EVENTS } = require('./constants');

function createMarkMessagesDelivered({ Message, idList }) {
  async function markMessagesDelivered(chatId, userId) {
    const missingDelivery = await Message.find({
      chat: chatId,
      sender: { $ne: userId },
      deliveredTo: { $ne: userId }
    }).sort({ createdAt: -1, _id: -1 }).limit(MAX_STATUS_UPDATE_EVENTS).select('_id deliveredTo seenBy');
    if (missingDelivery.length === 0) {
      return [];
    }
    await Message.updateMany({
      _id: {
        $in: missingDelivery.map(message => message._id)
      },
      chat: chatId,
      sender: { $ne: userId },
      deliveredTo: { $ne: userId }
    }, { $addToSet: { deliveredTo: userId } });
    return missingDelivery.map(message => ({
      chatId: chatId.toString(),
      messageId: message._id.toString(),
      deliveredTo: Array.from(new Set([...idList(message.deliveredTo), userId])),
      seenBy: idList(message.seenBy || [])
    }));
  }
  return markMessagesDelivered;
}

module.exports = createMarkMessagesDelivered;
