const { createExistingMessageFinder, CLIENT_MESSAGE_ID_CONFLICT } = require('./existing-message');
const { persistMessage } = require('./persist-message');
const { serializeOutgoing } = require('./serialize-outgoing');
const { broadcastMessage } = require('./broadcast-message');

async function updateChatMetadata(Chat, chatId, message) {
  try {
    await Chat.findByIdAndUpdate(chatId, {
      $set: { lastMessage: message._id, updatedAt: new Date() },
    });
  } catch (error) {
    console.error('Message chat metadata update error:', error);
  }
}

async function sendMessage(context, draft, onPersisted) {
  const { userId, models: { Chat, Message }, chatService: { isChatMember } } = context;
  const { runChatOperationExclusive } = context;
  const { chatId, replyToId } = draft;

  return runChatOperationExclusive(chatId, async () => {
    const chat = await Chat.findById(chatId);
    if (!chat || !isChatMember(chat, userId)) {
      return { error: 'Chat not found.' };
    }
    let replyMessageId = null;
    if (replyToId) {
      const replyMessage = await Message.findOne({ _id: replyToId, chat: chatId }).select('_id');
      if (replyMessage) {
        replyMessageId = replyMessage._id;
      }
    }

    const findExistingMessage = createExistingMessageFinder(context, draft, replyMessageId);
    let message = await findExistingMessage();
    if (message === false) {
      return { ...CLIENT_MESSAGE_ID_CONFLICT };
    }
    let isNewMessage = !message;
    if (isNewMessage) {
      const result = await persistMessage(context, draft, replyMessageId, findExistingMessage);
      if (result.error) {
        return result;
      }
      ({ message, isNewMessage } = result);
    }

    onPersisted(message);
    if (isNewMessage) {
      await updateChatMetadata(Chat, chatId, message);
    }
    const outgoingMessage = await serializeOutgoing(context, message);
    if (!isNewMessage) {
      return { ok: true, duplicate: true, message: outgoingMessage };
    }
    await broadcastMessage(context, { chat, chatId, message, outgoingMessage });
    return { ok: true, message: outgoingMessage };
  });
}

module.exports = { sendMessage };
