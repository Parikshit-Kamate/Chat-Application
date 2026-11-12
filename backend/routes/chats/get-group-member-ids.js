function getGroupMemberIds(chat) {
  return (chat.members || []).map(member => member.user.toString());
}

module.exports = getGroupMemberIds;
