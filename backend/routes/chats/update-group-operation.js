function createUpdateGroupOperation({ Chat, isChatMember, idList }) {
  return async function updateGroupOperation({ chatId, userId, req }) {
    const chat = await Chat.findById(chatId);
    if (!chat || !isChatMember(chat, userId)) {
      return { status: 404, error: 'Chat not found.' };
    }
    if (chat.type !== 'group') {
      return { status: 400, error: 'Only group chats can be updated.' };
    }
    if (!idList(chat.admins || []).includes(userId)) {
      return { status: 403, error: 'Only group admins can update group details.' };
    }
    const nextName = String(req.body.name || '').trim();
    if (!nextName || nextName.length < 2 || nextName.length > 60) {
      return { status: 400, error: 'Group name must be between 2 and 60 characters.' };
    }
    chat.name = nextName;
    await chat.save();
    return {
      chat,
      memberIds: chat.members.map(member => member.user.toString())
    };
  };
}

module.exports = createUpdateGroupOperation;
