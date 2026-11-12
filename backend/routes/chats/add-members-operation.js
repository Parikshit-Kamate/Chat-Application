const { MAX_GROUP_MEMBERS } = require('./dependencies');

function createAddMembersOperation({
  Chat,
  isChatMember,
  isGroupAdmin,
  getGroupMemberIds,
  User,
  areAcceptedFriends,
  joinUserSocketsToChat
}) {
  return async function addMembersOperation({ chatId, userId, requestedMemberIds }) {
    const chat = await Chat.findById(chatId);
    if (!chat || !isChatMember(chat, userId)) {
      return { status: 404, error: 'Chat not found.' };
    }
    if (chat.type !== 'group') {
      return { status: 400, error: 'Only group chats can have members added.' };
    }
    if (!isGroupAdmin(chat, userId)) {
      return { status: 403, error: 'Only group admins can add members.' };
    }
    const existingMemberIds = new Set(getGroupMemberIds(chat));
    const memberIdsToAdd = Array.from(new Set(requestedMemberIds)).filter(memberId => !existingMemberIds.has(memberId));
    if (memberIdsToAdd.length === 0) {
      return { status: 409, error: 'Selected users are already in this group.' };
    }
    if (existingMemberIds.size + memberIdsToAdd.length > MAX_GROUP_MEMBERS) {
      return { status: 400, error: `Groups can contain at most ${MAX_GROUP_MEMBERS} members.` };
    }
    const usersToAdd = await User.find({ _id: { $in: memberIdsToAdd } }).select('_id');
    if (usersToAdd.length !== memberIdsToAdd.length) {
      return { status: 400, error: 'One or more selected users do not exist.' };
    }
    if (!(await areAcceptedFriends(userId, memberIdsToAdd))) {
      return { status: 403, error: 'You can only add accepted friends to a group.' };
    }
    usersToAdd.forEach(user => {
      chat.members.push({ user: user._id, lastReadAt: new Date(0) });
    });
    await chat.save();
    joinUserSocketsToChat(memberIdsToAdd, chat._id.toString());
    return { chat, memberIdsToAdd, refreshedMemberIds: getGroupMemberIds(chat) };
  };
}

module.exports = createAddMembersOperation;
