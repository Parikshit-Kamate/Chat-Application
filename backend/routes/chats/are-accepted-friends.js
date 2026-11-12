function createAreAcceptedFriends({ hasAcceptedFriendship }) {
  return async function areAcceptedFriends(userId, targetUserIds) {
    const friendshipResults = await Promise.all(targetUserIds.map(targetUserId => hasAcceptedFriendship(userId, targetUserId)));
    return friendshipResults.every(Boolean);
  };
}

module.exports = createAreAcceptedFriends;
