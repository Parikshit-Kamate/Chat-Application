function createSerializeChat({ serializeUser, getUserDisplayName, idList, serializeMessage }) {
  function serializeChat(chat, viewerId, unreadCount = 0) {
    const members = (chat.members || []).map(member => {
      const memberUser = member.user && member.user.username ? member.user : null;
      const serialized = memberUser ? serializeUser(memberUser) : {
        id: member.user?.toString?.() || String(member.user),
        username: '',
        firstName: '',
        lastName: '',
        isOnline: false,
        lastSeen: null
      };
      return { ...serialized, lastReadAt: member.lastReadAt || null, joinedAt: member.joinedAt || null };
    });
    const directOtherMember = chat.type === 'direct' ? members.find(member => member.id !== viewerId) : null;
    return {
      id: chat._id.toString(),
      type: chat.type,
      name: chat.type === 'group' ? chat.name || 'Untitled Group' : getUserDisplayName(directOtherMember) || chat.name || 'Direct Chat',
      customName: chat.name || '',
      members,
      admins: idList(chat.admins || []),
      createdBy: chat.createdBy?.toString?.() || String(chat.createdBy),
      unreadCount,
      lastMessage: serializeMessage(chat.lastMessage),
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    };
  }
  return serializeChat;
}

module.exports = createSerializeChat;
