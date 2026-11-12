function isChatMember(chat, userId) {
  return (chat.members || []).some(member => member.user?.toString() === userId);
}

module.exports = isChatMember;
