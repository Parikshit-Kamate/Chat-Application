function createDeleteMessageOperation({
  Message,
  Chat,
  isChatMember,
  prepareMessageAttachmentsForDeletion,
  restoreMessageAttachments,
  syncChatLastMessage
}) {
  return async function deleteMessageOperation({ messageId, userId }) {
    const message = await Message.findById(messageId).select('_id chat sender');
    if (!message) {
      return { status: 404, error: 'Message not found.' };
    }
    const chat = await Chat.findById(message.chat).select('_id createdAt members.user');
    if (!chat || !isChatMember(chat, userId)) {
      return { status: 404, error: 'Chat not found.' };
    }
    if (message.sender.toString() !== userId) {
      return { status: 403, error: 'You can only delete your own messages.' };
    }
    await prepareMessageAttachmentsForDeletion({ messageId, ownerId: userId });
    try {
      const deletion = await Message.deleteOne({ _id: messageId, sender: userId });
      if (deletion?.deletedCount === 0) {
        await restoreMessageAttachments({ messageId, ownerId: userId });
        return { status: 404, error: 'Message not found.' };
      }
    } catch (error) {
      let messageStillExists;
      try {
        messageStillExists = await Message.exists({ _id: messageId, sender: userId });
      } catch (verificationError) {
        console.error('Message deletion verification error:', verificationError);
        throw error;
      }
      if (messageStillExists) {
        await restoreMessageAttachments({ messageId, ownerId: userId });
        throw error;
      }
    }
    try {
      await syncChatLastMessage(chat);
    } catch (error) {
      console.error('Message metadata reconciliation error:', error);
    }
    return {
      chatId: chat._id.toString(),
      memberIds: chat.members.map(member => member.user.toString())
    };
  };
}

module.exports = createDeleteMessageOperation;
