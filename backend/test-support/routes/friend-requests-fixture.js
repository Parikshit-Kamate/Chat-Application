const { objectId, query } = require('./query');
const { makeAuth } = require('./auth');
const { createJsonApp } = require('./http');
const { createFriendsRouter } = require('../../routes/friends-routes');

async function createFriendFixture() {
  const authHelpers = makeAuth();
  const requesterId = objectId();
  const recipientId = objectId();
  const requestId = objectId();
  const chatId = objectId();
  const friendRequests = [];
  const emittedEvents = [];

  const User = {
    findById(id) {
      const usersById = new Map([
        [requesterId, { _id: requesterId, username: 'requester' }],
        [recipientId, { _id: recipientId, username: 'recipient' }],
      ]);

      return query(usersById.get(id) || null);
    },
  };

  const FriendRequest = {
    async findOne(filters) {
      return friendRequests.find((request) => request.pairKey === filters.pairKey) || null;
    },
    async create(data) {
      const request = {
        _id: requestId,
        ...data,
        async save() {},
      };
      friendRequests.push(request);
      return request;
    },
    findById(id) {
      return query(friendRequests.find((request) => request._id === id) || null);
    },
  };

  const chatService = {
    buildPairKey(leftUserId, rightUserId) {
      return [leftUserId, rightUserId].sort().join(':');
    },
    async createOrReturnDirectChat() {
      return { _id: chatId };
    },
    async fetchChatByIdForUser() {
      return { id: chatId, type: 'direct' };
    },
    async fetchFriendOverview() {
      return { friends: [], incomingRequests: [], outgoingRequests: [] };
    },
    async findDirectChat() {
      return null;
    },
    serializeFriendRequest(request) {
      return {
        id: request._id.toString(),
        requester: request.requester.toString(),
        recipient: request.recipient.toString(),
        status: request.status,
      };
    },
  };

  const app = createJsonApp(
    '/api/friends',
    createFriendsRouter({
      authHelpers,
      chatService,
      models: { FriendRequest, User },
      realtime: {
        emitUserEvent(userIds, eventName) {
          emittedEvents.push({ userIds: userIds.map(String), eventName });
        },
      },
    })
  );
  return {
    app,
    authHelpers,
    requesterId,
    recipientId,
    requestId,
    chatId,
    friendRequests,
    emittedEvents,
  };
}

module.exports = { createFriendFixture };
