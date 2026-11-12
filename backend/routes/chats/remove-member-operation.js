function createRemoveMemberOperation({
  Chat,
  isChatMember,
  getGroupMemberIds,
  isGroupAdmin,
  leaveUserSocketsFromChat
}) {
  return async function removeMemberOperation({ chatId, userId, targetMemberId }) {
    const chat = await Chat.findById(chatId);
    if (!chat || !isChatMember(chat, userId)) {
      return { status: 404, error: 'Chat not found.' };
    }
    if (chat.type !== 'group') {
      return { status: 400, error: 'Only group chats can have members removed.' };
    }
    const currentMemberIds = getGroupMemberIds(chat);
    if (!currentMemberIds.includes(targetMemberId)) {
      return { status: 404, error: 'Member is not in this group.' };
    }
    const isSelfRemoval = targetMemberId === userId;
    if (!isSelfRemoval && !isGroupAdmin(chat, userId)) {
      return { status: 403, error: 'Only group admins can remove other members.' };
    }
    if (currentMemberIds.length <= 1) {
      return { status: 409, error: 'Cannot remove the last group member.' };
    }
    chat.members = chat.members.filter(member => member.user.toString() !== targetMemberId);
    chat.admins = (chat.admins || []).filter(adminId => adminId.toString() !== targetMemberId);
    if ((chat.admins || []).length === 0 && chat.members.length > 0) {
      chat.admins = [chat.members[0].user];
    }
    await chat.save();
    await leaveUserSocketsFromChat(targetMemberId, chat._id.toString());
    return { chat, currentMemberIds, isSelfRemoval };
  };
}

module.exports = createRemoveMemberOperation;
