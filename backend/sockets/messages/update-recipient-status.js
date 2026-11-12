const mongoose = require('mongoose');

async function updateRecipientStatus(context, details) {
  const { io, models: { Chat, Message }, chatService: { idList } } = context;
  const { chatId, message, outgoingMessage, onlineRecipients, activeRecipients } = details;
  if (onlineRecipients.length === 0) {
    return;
  }

  try {
    const addToSet = { deliveredTo: { $each: onlineRecipients } };
    if (activeRecipients.length > 0) {
      addToSet.seenBy = { $each: activeRecipients };
    }
    const updatedStatusMessage = await Message.findByIdAndUpdate(
      message._id, { $addToSet: addToSet }, { new: true }
    );
    if (activeRecipients.length > 0) {
      await Chat.updateOne(
        { _id: chatId },
        { $set: { 'members.$[member].lastReadAt': new Date() } },
        { arrayFilters: [{
          'member.user': { $in: activeRecipients.map((memberId) => new mongoose.Types.ObjectId(memberId)) },
        }] }
      );
    }
    io.to(`chat:${chatId}`).emit('message:status', {
      chatId,
      messageId: outgoingMessage.id,
      deliveredTo: idList(updatedStatusMessage?.deliveredTo || outgoingMessage.deliveredTo),
      seenBy: idList(updatedStatusMessage?.seenBy || outgoingMessage.seenBy),
    });
  } catch (error) {
    console.error('Message status update error:', error);
  }
}

module.exports = { updateRecipientStatus };
