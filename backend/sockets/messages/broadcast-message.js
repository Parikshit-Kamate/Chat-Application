const { updateRecipientStatus } = require('./update-recipient-status');

async function broadcastMessage(context, { chat, chatId, message, outgoingMessage }) {
  const { userId, io, realtime: { isUserOnline, isUserActiveInChat } } = context;
  const memberIds = chat.members.map((member) => member.user.toString());
  const onlineRecipients = memberIds.filter((memberId) => memberId !== userId && isUserOnline(memberId));
  const activeRecipients = onlineRecipients.filter((memberId) => isUserActiveInChat(memberId, chatId));

  io.to(`chat:${chatId}`).emit('message:new', outgoingMessage);
  await updateRecipientStatus(context, {
    chatId, message, outgoingMessage, onlineRecipients, activeRecipients,
  });

  memberIds.forEach((memberId) => {
    io.to(`user:${memberId}`).emit('chat:list:refresh');
  });
  for (const memberId of memberIds) {
    if (memberId !== userId && !isUserActiveInChat(memberId, chatId)) {
      io.to(`user:${memberId}`).emit('notification:new_message', { chatId, message: outgoingMessage });
    }
  }
}

module.exports = { broadcastMessage };
