const { supportsAttachments, createAttachmentClaim } = require('./attachment-claim');
const { CLIENT_MESSAGE_ID_CONFLICT } = require('./existing-message');

async function persistMessage(context, draft, replyMessageId, findExistingMessage) {
  const { models: { Message }, userId, chatService } = context;
  const { chatId, clientMessageId, text, rawAttachments } = draft;
  if (rawAttachments.length > 0 && !supportsAttachments(chatService)) {
    return { error: 'Attachments are temporarily unavailable.' };
  }

  const attachmentClaim = createAttachmentClaim(context, rawAttachments);
  const { messageId } = attachmentClaim;
  try {
    const attachments = await attachmentClaim.claim();
    const message = await Message.create({
      _id: messageId,
      chat: chatId,
      sender: userId,
      clientMessageId,
      text,
      attachments,
      replyTo: replyMessageId,
      deliveredTo: [userId],
      seenBy: [userId],
    });
    await attachmentClaim.finalize();
    return { message, isNewMessage: true };
  } catch (error) {
    let committedMessage = null;
    try {
      committedMessage = await Message.findOne({
        _id: messageId, chat: chatId, sender: userId, clientMessageId,
      });
    } catch (verificationError) {
      console.error('Message persistence verification error:', verificationError);
      throw error;
    }
    if (committedMessage) {
      await attachmentClaim.finalize();
      return { message: committedMessage, isNewMessage: true };
    }
    await attachmentClaim.release();
    if (error?.code === 'INVALID_UPLOAD_ATTACHMENT') {
      return { error: 'One or more attachments are not allowed.' };
    }
    if (error?.code !== 11000) {
      throw error;
    }
    const message = await findExistingMessage();
    return message ? { message, isNewMessage: false } : { ...CLIENT_MESSAGE_ID_CONFLICT };
  }
}

module.exports = { persistMessage };
