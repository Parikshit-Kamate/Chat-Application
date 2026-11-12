function createSerializeMessage({ serializeUser, normalizeAttachment, serializeReply, idList }) {
  function serializeMessage(message) {
    if (!message) {
      return null;
    }
    const sender = message.sender && message.sender.username ? message.sender : null;
    return {
      id: message._id.toString(),
      chatId: message.chat?.toString?.() || String(message.chat),
      sender: sender ? serializeUser(sender) : {
        id: message.sender?.toString?.() || String(message.sender),
        username: '',
        firstName: '',
        lastName: '',
        isOnline: false,
        lastSeen: null
      },
      text: message.text || '',
      attachments: Array.isArray(message.attachments) ? message.attachments.map(normalizeAttachment).filter(Boolean) : [],
      replyTo: serializeReply(message.replyTo),
      deliveredTo: idList(message.deliveredTo || []),
      seenBy: idList(message.seenBy || []),
      createdAt: message.createdAt,
      updatedAt: message.updatedAt
    };
  }
  return serializeMessage;
}

module.exports = createSerializeMessage;
