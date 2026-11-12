const { normalizeObjectId, MAX_GROUP_MEMBERS } = require('./dependencies');

function createCreateGroupChat({ User, areAcceptedFriends, Chat, emitUserEvent, fetchChatByIdForUser }) {
  return async function createGroupChat(req, res) {
    try {
      const creatorId = req.auth.sub;
      const name = String(req.body.name || '').trim();
      const rawParticipantIds = Array.isArray(req.body.participantIds) ? req.body.participantIds : [];
      const participantIds = rawParticipantIds.map(normalizeObjectId);
      if (name.length < 2 || name.length > 60) {
        return res.status(400).json({ error: 'Group name must be between 2 and 60 characters.' });
      }
      if (participantIds.length > MAX_GROUP_MEMBERS - 1) {
        return res.status(400).json({ error: `Groups can contain at most ${MAX_GROUP_MEMBERS} members.` });
      }
      if (participantIds.some(id => !id)) {
        return res.status(400).json({ error: 'One or more selected users are invalid.' });
      }
      const uniqueMembers = new Set([creatorId]);
      participantIds.forEach(id => {
        uniqueMembers.add(id);
      });
      if (uniqueMembers.size < 3) {
        return res.status(400).json({ error: 'A group chat needs at least 3 members (including you).' });
      }
      const memberIds = Array.from(uniqueMembers);
      if (memberIds.length > MAX_GROUP_MEMBERS) {
        return res.status(400).json({ error: `Groups can contain at most ${MAX_GROUP_MEMBERS} members.` });
      }
      const existingUsers = await User.find({ _id: { $in: memberIds } }).select('_id');
      if (existingUsers.length !== memberIds.length) {
        return res.status(400).json({ error: 'One or more selected users do not exist.' });
      }
      const invitedMemberIds = memberIds.filter(memberId => memberId !== creatorId);
      if (!(await areAcceptedFriends(creatorId, invitedMemberIds))) {
        return res.status(403).json({ error: 'You can only add accepted friends to a group.' });
      }
      const now = new Date();
      const chat = await Chat.create({
        type: 'group',
        name,
        members: memberIds.map(memberId => ({
          user: memberId,
          lastReadAt: memberId === creatorId ? now : new Date(0)
        })),
        admins: [creatorId],
        createdBy: creatorId
      });
      emitUserEvent(memberIds, 'chat:list:refresh');
      const hydratedChat = await fetchChatByIdForUser(chat._id, creatorId);
      return res.status(201).json({ chat: hydratedChat });
    } catch (error) {
      console.error('Group chat create error:', error);
      return res.status(500).json({ error: 'Unable to create group chat.' });
    }
  };
}

module.exports = createCreateGroupChat;
