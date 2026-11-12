const mongoose = require('mongoose');
const { MAX_CHAT_LIST_SIZE } = require('./constants');

function createFetchChatsForUser({ Chat, Message, serializeChat }) {
  async function fetchChatsForUser(userId) {
    const chats = await Chat.find({ 'members.user': userId })
      .sort({ updatedAt: -1 })
      .limit(MAX_CHAT_LIST_SIZE)
      .populate('members.user', 'username firstName lastName isOnline lastSeen')
      .populate({
      path: 'lastMessage',
      populate: [{ path: 'sender', select: 'username firstName lastName isOnline lastSeen' }]
    });
    if (chats.length === 0) {
      return [];
    }
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const unreadCounts = await Message.aggregate([{
      $match: {
        chat: {
          $in: chats.map(chat => chat._id)
        },
        sender: { $ne: userObjectId },
        seenBy: { $ne: userObjectId }
      }
    }, { $group: { _id: '$chat', count: { $sum: 1 } } }]);
    const unreadCountByChatId = new Map(unreadCounts.map(entry => [entry._id.toString(), Number(entry.count) || 0]));
    return chats.map(chat => serializeChat(chat, userId, unreadCountByChatId.get(chat._id.toString()) || 0));
  }
  return fetchChatsForUser;
}

module.exports = createFetchChatsForUser;
