function createHasAcceptedFriendship({ FriendRequest, buildPairKey }) {
  async function hasAcceptedFriendship(userId, targetUserId) {
    const friendship = await FriendRequest.findOne({
      pairKey: buildPairKey(userId, targetUserId),
      status: 'accepted'
    }).select('_id');
    return Boolean(friendship);
  }
  return hasAcceptedFriendship;
}

module.exports = createHasAcceptedFriendship;
