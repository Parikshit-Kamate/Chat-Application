const { MAX_FRIEND_OVERVIEW_ITEMS } = require('./constants');

function createFetchFriendOverview({ FriendRequest, Chat, serializeFriendRequest, serializeUserValue }) {
  async function fetchFriendOverview(userId) {
    const [acceptedRequests, incomingRequests, outgoingRequests, directChats] = await Promise.all([FriendRequest.find({
      status: 'accepted',
      $or: [{ requester: userId }, { recipient: userId }]
    })
      .sort({ updatedAt: -1 })
      .limit(MAX_FRIEND_OVERVIEW_ITEMS)
      .populate('requester', 'username firstName lastName isOnline lastSeen')
      .populate('recipient', 'username firstName lastName isOnline lastSeen'), FriendRequest.find({
      recipient: userId,
      status: 'pending'
    })
      .sort({ createdAt: -1 })
      .limit(MAX_FRIEND_OVERVIEW_ITEMS)
      .populate('requester', 'username firstName lastName')
      .populate('recipient', 'username firstName lastName'), FriendRequest.find({
      requester: userId,
      status: 'pending'
    })
      .sort({ createdAt: -1 })
      .limit(MAX_FRIEND_OVERVIEW_ITEMS)
      .populate('requester', 'username firstName lastName')
      .populate('recipient', 'username firstName lastName'), Chat.find({
      type: 'direct',
      'members.user': userId,
      $expr: { $eq: [{ $size: '$members' }, 2] }
    })
      .sort({ updatedAt: -1 })
      .limit(MAX_FRIEND_OVERVIEW_ITEMS)
      .select('_id members.user updatedAt')
      .populate('members.user', 'username firstName lastName isOnline lastSeen')]);
    const friendsById = new Map();
    acceptedRequests.forEach(request => {
      const serializedRequest = serializeFriendRequest(request, userId);
      if (!serializedRequest.user?.id) {
        return;
      }
      friendsById.set(serializedRequest.user.id, { ...serializedRequest.user, chatId: null });
    });
    directChats.forEach(chat => {
      const otherMember = (chat.members || []).find(member => serializeUserValue(member.user)?.id !== userId);
      const otherUser = serializeUserValue(otherMember?.user);
      if (!otherUser?.id) {
        return;
      }
      const existingFriend = friendsById.get(otherUser.id) || {};
      friendsById.set(otherUser.id, { ...existingFriend, ...otherUser, chatId: chat._id.toString() });
    });
    const friends = Array.from(friendsById.values())
      .sort((leftUser, rightUser) => leftUser.username.localeCompare(
      rightUser.username,
      undefined,
      {
      sensitivity: 'base'
    }
    ));
    return {
      friends,
      incomingRequests: incomingRequests.map(request => serializeFriendRequest(request, userId)),
      outgoingRequests: outgoingRequests.map(request => serializeFriendRequest(request, userId))
    };
  }
  return fetchFriendOverview;
}

module.exports = createFetchFriendOverview;
