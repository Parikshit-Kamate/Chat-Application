async function serializeOutgoing(context, message) {
  const { userId, username, models: { Message }, chatService: { serializeMessage } } = context;
  let hydratedMessage = null;
  try {
    hydratedMessage = await Message.findById(message._id)
      .populate('sender', 'username firstName lastName isOnline lastSeen')
      .populate({
        path: 'replyTo',
        populate: [{ path: 'sender', select: 'username firstName lastName isOnline lastSeen' }],
      });
  } catch (error) {
    console.error('Message hydration error:', error);
  }

  return serializeMessage(hydratedMessage || {
    _id: message._id,
    chat: message.chat,
    sender: { _id: userId, username, firstName: '', lastName: '', isOnline: true, lastSeen: null },
    text: message.text,
    attachments: message.attachments,
    replyTo: null,
    deliveredTo: message.deliveredTo,
    seenBy: message.seenBy,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  });
}

module.exports = { serializeOutgoing };
