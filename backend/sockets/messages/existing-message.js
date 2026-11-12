const CLIENT_MESSAGE_ID_CONFLICT = {
  error: 'This message draft changed before delivery was confirmed. Please send it again.',
  code: 'CLIENT_MESSAGE_ID_CONFLICT',
};

function createExistingMessageFinder(context, draft, replyMessageId) {
  const { models: { Message }, userId } = context;
  const { chatId, clientMessageId, text, replyToId, uploadIds } = draft;

  return async () => {
    const existingMessage = await Message.findOne({ sender: userId, clientMessageId });
    const existingSenderId = existingMessage?.sender?._id?.toString?.() ||
      existingMessage?.sender?.toString?.() || '';
    const existingChatId = existingMessage?.chat?.toString?.() || '';
    const existingReplyToId = existingMessage?.replyTo?._id?.toString?.() ||
      existingMessage?.replyTo?.toString?.() || '';
    const existingUploadIds = Array.isArray(existingMessage?.attachments)
      ? existingMessage.attachments.map((attachment) =>
        attachment?.uploadId?.toString?.() || String(attachment?.uploadId || ''))
      : [];

    if (!existingMessage) {
      return null;
    }
    if (existingSenderId !== userId || existingChatId !== chatId ||
      existingMessage.clientMessageId !== clientMessageId ||
      String(existingMessage.text || '') !== text ||
      (existingReplyToId ? existingReplyToId !== (replyToId || '') : Boolean(replyMessageId)) ||
      existingUploadIds.length !== uploadIds.length ||
      existingUploadIds.some((uploadId, index) => uploadId !== uploadIds[index])) {
      return false;
    }
    return existingMessage;
  };
}

module.exports = { CLIENT_MESSAGE_ID_CONFLICT, createExistingMessageFinder };
