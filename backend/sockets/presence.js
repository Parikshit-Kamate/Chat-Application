function getChatCoMemberIds(chats, userId) {
  const coMemberIds = new Set();
  (chats || []).forEach((chat) => {
    (chat.members || []).forEach((member) => {
      const memberId = member.user?._id?.toString?.() || member.user?.toString?.() || '';
      if (memberId && memberId !== userId) {
        coMemberIds.add(memberId);
      }
    });
  });
  return Array.from(coMemberIds);
}

function emitPresence({ io, realtime }, coMemberIds, payload) {
  if (coMemberIds.length === 0) {
    return;
  }
  if (typeof realtime.emitUserEvent === 'function') {
    realtime.emitUserEvent(coMemberIds, 'presence:update', payload);
    return;
  }
  coMemberIds.forEach((coMemberId) => {
    io.to(`user:${coMemberId}`).emit('presence:update', payload);
  });
}

function createPresenceReconciler(context) {
  const { models: { Chat, User }, realtime: { isUserOnline } } = context;
  const queues = new Map();

  return (userId, preloadedChats = null) => {
    const previousUpdate = queues.get(userId) || Promise.resolve();
    const queuedUpdate = previousUpdate.catch(() => {}).then(async () => {
      const isOnlineAtStart = isUserOnline(userId);
      const lastSeen = isOnlineAtStart ? null : new Date();
      await User.findByIdAndUpdate(userId, {
        $set: { isOnline: isOnlineAtStart, lastSeen },
      });
      const currentUserChats = preloadedChats ||
        (await Chat.find({ 'members.user': userId }).select('members.user').limit(200));
      if (isUserOnline(userId) !== isOnlineAtStart) {
        return;
      }
      emitPresence(context, getChatCoMemberIds(currentUserChats, userId), {
        userId,
        isOnline: isOnlineAtStart,
        lastSeen,
      });
    });
    const trackedUpdate = queuedUpdate.catch((error) => {
      console.error('Presence reconciliation error:', error);
    }).finally(() => {
      if (queues.get(userId) === trackedUpdate) {
        queues.delete(userId);
      }
    });
    queues.set(userId, trackedUpdate);
    return trackedUpdate;
  };
}

module.exports = { createPresenceReconciler };
