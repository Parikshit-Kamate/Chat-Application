const assert = require('node:assert/strict');
const http = require('node:http');
const test = require('node:test');
const express = require('express');
const mongoose = require('mongoose');

const { createAuthHelpers } = require('../lib/auth');
const { createRealtimeHelpers } = require('../lib/realtime');
const { createAuthRouter } = require('../routes/auth-routes');
const { createChatsRouter } = require('../routes/chats-routes');
const { createFriendsRouter } = require('../routes/friends-routes');
const { createMessagesRouter } = require('../routes/messages-routes');
const { createUploadsRouter } = require('../routes/uploads-routes');
const { registerChatSocketHandlers } = require('../sockets/register-chat-socket-handlers');

function objectId() {
  return new mongoose.Types.ObjectId().toString();
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function query(value) {
  return {
    select() {
      return this;
    },
    populate() {
      return this;
    },
    sort() {
      return this;
    },
    limit() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
    catch(reject) {
      return Promise.resolve(value).catch(reject);
    },
  };
}

function serializeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: user._id?.toString?.() || user.id?.toString?.() || String(user),
    username: user.username || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    isOnline: Boolean(user.isOnline),
    lastSeen: user.lastSeen || null,
  };
}

function makeAuth() {
  return createAuthHelpers({
    jwtSecret: 'route-test-secret',
    jwtExpiresInSeconds: 60 * 60,
  });
}

function createJsonApp(mountPath, router) {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use(mountPath, router);
  return app;
}

async function withServer(app, run) {
  const server = http.createServer(app);

  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  try {
    return await run(server);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function requestJson(server, { method = 'GET', path, body, token }) {
  const payload = body === undefined ? '' : JSON.stringify(body);
  const { port } = server.address();

  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          Accept: 'application/json',
          ...(payload
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
              }
            : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (response) => {
        let data = '';

        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          resolve({
            status: response.statusCode,
            body: data ? JSON.parse(data) : null,
          });
        });
      }
    );

    request.on('error', reject);

    if (payload) {
      request.write(payload);
    }

    request.end();
  });
}

test('auth routes register users and then login with the stored password hash', async () => {
  const authHelpers = makeAuth();
  const users = [];

  const User = {
    async findOne(filters) {
      return users.find((user) => user.usernameLower === filters.usernameLower) || null;
    },
    async create(data) {
      const user = {
        _id: objectId(),
        ...data,
        isOnline: false,
        lastSeen: null,
      };
      users.push(user);
      return user;
    },
    findById(id) {
      return query(users.find((user) => user._id === id) || null);
    },
  };

  const app = createJsonApp(
    '/api/auth',
    createAuthRouter({
      authHelpers,
      chatService: { serializeUser },
      models: { User },
    })
  );

  await withServer(app, async (server) => {
    const registerResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/register',
      body: {
        firstName: 'Parikshit',
        lastName: 'Singh',
        username: 'Parikshit',
        password: 'correct-password',
      },
    });

    assert.equal(registerResponse.status, 201);
    assert.equal(registerResponse.body.user.username, 'Parikshit');
    assert.equal(registerResponse.body.user.firstName, 'Parikshit');
    assert.equal(registerResponse.body.user.lastName, 'Singh');
    assert.equal(typeof registerResponse.body.token, 'string');
    assert.notEqual(users[0].passwordHash, 'correct-password');

    const loginResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        username: 'parikshit',
        password: 'correct-password',
      },
    });

    assert.equal(loginResponse.status, 200);
    assert.equal(loginResponse.body.user.id, users[0]._id);

    const invalidLoginResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/auth/login',
      body: {
        username: 'parikshit',
        password: 'wrong-password',
      },
    });

    assert.equal(invalidLoginResponse.status, 401);
  });
});

test('auth login route throttles repeated failed attempts', async () => {
  const authHelpers = makeAuth();
  const user = {
    _id: objectId(),
    username: 'Parikshit',
    usernameLower: 'parikshit',
    passwordHash: await authHelpers.hashPassword('correct-password'),
    isOnline: false,
    lastSeen: null,
  };

  const User = {
    async findOne(filters) {
      return filters.usernameLower === user.usernameLower ? user : null;
    },
    findById(id) {
      return query(id === user._id ? user : null);
    },
  };

  const app = createJsonApp(
    '/api/auth',
    createAuthRouter({
      authHelpers,
      chatService: { serializeUser },
      models: { User },
    })
  );

  await withServer(app, async (server) => {
    for (let attempt = 1; attempt <= 11; attempt += 1) {
      const response = await requestJson(server, {
        method: 'POST',
        path: '/api/auth/login',
        body: {
          username: 'parikshit',
          password: 'wrong-password',
        },
      });

      assert.equal(response.status, attempt <= 10 ? 401 : 429);
    }
  });
});

test('friend request routes create and accept pending requests', async () => {
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

  await withServer(app, async (server) => {
    const requesterToken = authHelpers.createJwtToken({ sub: requesterId, username: 'requester' });
    const recipientToken = authHelpers.createJwtToken({ sub: recipientId, username: 'recipient' });

    const uppercaseSelfResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/friends/requests',
      token: requesterToken,
      body: { recipientUserId: requesterId.toUpperCase() },
    });

    assert.equal(uppercaseSelfResponse.status, 400);
    assert.equal(friendRequests.length, 0);

    const createResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/friends/requests',
      token: requesterToken,
      body: { recipientUserId: recipientId },
    });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.body.request.status, 'pending');
    assert.equal(friendRequests[0].pairKey, [requesterId, recipientId].sort().join(':'));

    const acceptResponse = await requestJson(server, {
      method: 'POST',
      path: `/api/friends/requests/${requestId}/accept`,
      token: recipientToken,
      body: {},
    });

    assert.equal(acceptResponse.status, 200);
    assert.equal(acceptResponse.body.request.status, 'accepted');
    assert.equal(acceptResponse.body.chat.id, chatId);
    assert.deepEqual(
      emittedEvents.map((event) => event.eventName),
      ['friends:refresh', 'friends:refresh', 'chat:list:refresh']
    );
  });
});

test('realtime helper removes every live user socket from a chat room', async () => {
  const userId = objectId();
  const chatId = objectId();
  const otherChatId = objectId();
  const leftRooms = [];
  const sockets = new Map([
    [
      'socket-1',
      {
        data: { activeChatId: chatId },
        leave(roomName) {
          leftRooms.push({ socketId: 'socket-1', roomName });
        },
      },
    ],
    [
      'socket-2',
      {
        data: { activeChatId: otherChatId },
        leave(roomName) {
          leftRooms.push({ socketId: 'socket-2', roomName });
        },
      },
    ],
  ]);
  const realtime = createRealtimeHelpers({ sockets: { sockets } });

  realtime.addUserSocket(userId, 'socket-1');
  realtime.addUserSocket(userId, 'socket-2');
  await realtime.leaveUserSocketsFromChat(userId, chatId);

  assert.deepEqual(leftRooms, [
    { socketId: 'socket-1', roomName: `chat:${chatId}` },
    { socketId: 'socket-2', roomName: `chat:${chatId}` },
  ]);
  assert.equal(sockets.get('socket-1').data.activeChatId, null);
  assert.equal(sockets.get('socket-2').data.activeChatId, otherChatId);
});

test('chat routes serialize group mutations and mark unread messages as read', async () => {
  const authHelpers = makeAuth();
  const creatorId = objectId();
  const memberId = objectId();
  const secondMemberId = objectId();
  const addedMemberId = objectId();
  const chatId = objectId();
  const messageId = objectId();
  const emittedUserEvents = [];
  const emittedStatusUpdates = [];
  const evictedUserSockets = [];
  const exclusiveChatOperations = [];
  let insideExclusiveChatOperation = false;
  let createdChat = null;

  const User = {
    find(filters) {
      const users = [creatorId, memberId, secondMemberId, addedMemberId].map((id) => ({ _id: id }));
      const selectedIds = new Set((filters._id?.$in || []).map(String));
      return query(users.filter((user) => selectedIds.has(user._id)));
    },
  };

  const Chat = {
    async create(data) {
      createdChat = {
        _id: chatId,
        ...data,
        async save() {},
      };
      return createdChat;
    },
    async findById(id) {
      return id === chatId ? createdChat : null;
    },
  };

  const chatService = {
    async createOrReturnDirectChat() {
      return null;
    },
    emitStatusUpdates(chatIdValue, updates) {
      emittedStatusUpdates.push({ chatId: chatIdValue, updates });
    },
    escapeRegExp(value) {
      return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    },
    async fetchChatByIdForUser() {
      return {
        id: chatId,
        type: 'group',
        members: createdChat.members.map((member) => ({ id: member.user.toString() })),
      };
    },
    async fetchChatsForUser() {
      return [];
    },
    async findDirectChat() {
      return null;
    },
    async hasAcceptedFriendship() {
      return true;
    },
    idList(values = []) {
      return values.map((value) => value.toString());
    },
    isChatMember(chat, userId) {
      return (chat.members || []).some((member) => member.user.toString() === userId);
    },
    async markMessagesDelivered() {
      return [];
    },
    async markMessagesSeen() {
      return [
        {
          chatId,
          messageId,
          deliveredTo: [creatorId],
          seenBy: [creatorId],
        },
      ];
    },
    serializeMessage(message) {
      return message;
    },
  };

  const app = createJsonApp(
    '/api',
    createChatsRouter({
      authHelpers,
      chatService,
      models: { Chat, Message: {}, User },
      realtime: {
        emitUserEvent(userIds, eventName) {
          emittedUserEvents.push({ userIds: userIds.map(String), eventName });
        },
        joinUserSocketsToChat() {
          assert.equal(insideExclusiveChatOperation, true);
        },
        leaveUserSocketsFromChat(userId, chatIdValue) {
          evictedUserSockets.push({ userId, chatId: chatIdValue });
        },
        async runChatOperationExclusive(chatIdValue, operation) {
          exclusiveChatOperations.push(chatIdValue);
          insideExclusiveChatOperation = true;
          try {
            return await operation();
          } finally {
            insideExclusiveChatOperation = false;
          }
        },
      },
    })
  );

  await withServer(app, async (server) => {
    const token = authHelpers.createJwtToken({ sub: creatorId, username: 'creator' });

    const duplicateMemberResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/chats/group',
      token,
      body: {
        name: 'Invalid Duplicate Group',
        participantIds: [memberId, memberId.toUpperCase()],
      },
    });

    assert.equal(duplicateMemberResponse.status, 400);
    assert.equal(createdChat, null);

    const createResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/chats/group',
      token,
      body: {
        name: 'Project Team',
        participantIds: [memberId, secondMemberId],
      },
    });

    assert.equal(createResponse.status, 201);
    assert.equal(createdChat.type, 'group');
    assert.equal(createdChat.members.length, 3);
    assert.deepEqual(createdChat.admins, [creatorId]);

    const updateResponse = await requestJson(server, {
      method: 'PATCH',
      path: `/api/chats/${chatId}`,
      token,
      body: { name: 'Renamed Team' },
    });

    assert.equal(updateResponse.status, 200);
    assert.equal(createdChat.name, 'Renamed Team');

    const addResponse = await requestJson(server, {
      method: 'POST',
      path: `/api/chats/${chatId}/members`,
      token,
      body: { memberIds: [addedMemberId] },
    });

    assert.equal(addResponse.status, 201);
    assert.deepEqual(addResponse.body.addedMemberIds, [addedMemberId]);
    assert.equal(createdChat.members.some((member) => member.user.toString() === addedMemberId), true);

    const readResponse = await requestJson(server, {
      method: 'POST',
      path: `/api/chats/${chatId}/read`,
      token,
      body: {},
    });

    assert.equal(readResponse.status, 200);
    assert.equal(readResponse.body.seenCount, 1);
    assert.equal(emittedStatusUpdates[0].updates[0].messageId, messageId);
    assert.equal(emittedUserEvents.at(-1).eventName, 'chat:list:refresh');

    const removeResponse = await requestJson(server, {
      method: 'DELETE',
      path: `/api/chats/${chatId}/members/${memberId}`,
      token,
    });

    assert.equal(removeResponse.status, 200);
    assert.equal(removeResponse.body.removedMemberId, memberId);
    assert.deepEqual(evictedUserSockets, [{ userId: memberId, chatId }]);
    assert.deepEqual(exclusiveChatOperations, [chatId, chatId, chatId]);
  });
});

test('message deletion is serialized without waiting for remote attachment cleanup', async () => {
  const authHelpers = makeAuth();
  const userId = objectId();
  const peerId = objectId();
  const chatId = objectId();
  const messageId = objectId();
  const calls = [];
  const cleanupStarted = deferred();
  const cleanupMayFinish = deferred();
  let messageDeleted = false;
  const message = { _id: messageId, chat: chatId, sender: userId };
  const chat = {
    _id: chatId,
    createdAt: new Date(),
    members: [{ user: userId }, { user: peerId }],
  };
  const Message = {
    findById() {
      return query(messageDeleted ? null : message);
    },
    async deleteOne() {
      calls.push('delete-message');
      messageDeleted = true;
      return { deletedCount: 1 };
    },
  };
  const Chat = {
    findById() {
      return query(chat);
    },
  };
  const app = createJsonApp(
    '/api',
    createMessagesRouter({
      authHelpers,
      chatService: {
        async deleteMessageAttachments() {
          calls.push('delete-attachments');
          cleanupStarted.resolve();
          await cleanupMayFinish.promise;
          return { deleted: 1, failed: 0 };
        },
        isChatMember(chatDocument, currentUserId) {
          return chatDocument.members.some((member) => member.user.toString() === currentUserId);
        },
        async prepareMessageAttachmentsForDeletion() {
          calls.push('prepare-attachments');
        },
        async restoreMessageAttachments() {
          calls.push('restore-attachments');
        },
        async syncChatLastMessage() {
          calls.push('sync-last-message');
        },
      },
      io: { to: () => ({ emit() {} }) },
      models: { Chat, Message },
      realtime: {
        emitUserEvent() {},
        async runChatOperationExclusive(lockedChatId, operation) {
          assert.equal(lockedChatId, chatId);
          calls.push('lock');
          return operation();
        },
      },
    })
  );

  await withServer(app, async (server) => {
    const token = authHelpers.createJwtToken({ sub: userId, username: 'owner' });
    const responsePromise = requestJson(server, {
      method: 'DELETE',
      path: `/api/messages/${messageId}`,
      token,
    });
    await cleanupStarted.promise;
    const responseBeforeCleanup = await Promise.race([
      responsePromise.then((response) => ({ response })),
      new Promise((resolve) => setTimeout(() => resolve(null), 500)),
    ]);
    cleanupMayFinish.resolve();
    const response = responseBeforeCleanup?.response || (await responsePromise);

    assert.ok(responseBeforeCleanup, 'The HTTP response should not wait for attachment storage cleanup.');
    assert.equal(response.status, 200);
    assert.deepEqual(calls, [
      'lock',
      'prepare-attachments',
      'delete-message',
      'sync-last-message',
      'delete-attachments',
    ]);
  });
});

test('message deletion does not restore attachments when the database committed before reporting an error', async () => {
  const authHelpers = makeAuth();
  const userId = objectId();
  const peerId = objectId();
  const chatId = objectId();
  const messageId = objectId();
  const calls = [];
  let messageDeleted = false;
  const message = { _id: messageId, chat: chatId, sender: userId };
  const chat = {
    _id: chatId,
    createdAt: new Date(),
    members: [{ user: userId }, { user: peerId }],
  };
  const Message = {
    findById() {
      return query(messageDeleted ? null : message);
    },
    async deleteOne() {
      calls.push('delete-message');
      messageDeleted = true;
      throw new Error('simulated acknowledgement loss');
    },
    async exists() {
      calls.push('verify-message-deleted');
      return null;
    },
  };
  const Chat = {
    findById() {
      return query(chat);
    },
  };
  const app = createJsonApp(
    '/api',
    createMessagesRouter({
      authHelpers,
      chatService: {
        async deleteMessageAttachments() {
          calls.push('delete-attachments');
        },
        isChatMember(chatDocument, currentUserId) {
          return chatDocument.members.some((member) => member.user.toString() === currentUserId);
        },
        async prepareMessageAttachmentsForDeletion() {
          calls.push('prepare-attachments');
        },
        async restoreMessageAttachments() {
          calls.push('restore-attachments');
        },
        async syncChatLastMessage() {
          calls.push('sync-last-message');
        },
      },
      io: { to: () => ({ emit() {} }) },
      models: { Chat, Message },
      realtime: {
        emitUserEvent() {},
        async runChatOperationExclusive(_lockedChatId, operation) {
          calls.push('lock');
          return operation();
        },
      },
    })
  );

  await withServer(app, async (server) => {
    const token = authHelpers.createJwtToken({ sub: userId, username: 'owner' });
    const response = await requestJson(server, {
      method: 'DELETE',
      path: `/api/messages/${messageId}`,
      token,
    });

    assert.equal(response.status, 200);
    assert.equal(calls.includes('restore-attachments'), false);
    assert.deepEqual(calls, [
      'lock',
      'prepare-attachments',
      'delete-message',
      'verify-message-deleted',
      'sync-last-message',
      'delete-attachments',
    ]);
  });
});

test('message deletion bounds concurrent remote attachment cleanup jobs', async () => {
  const authHelpers = makeAuth();
  const userId = objectId();
  const peerId = objectId();
  const messageIds = [objectId(), objectId(), objectId()];
  const chats = new Map();
  const messages = new Map();
  for (const messageId of messageIds) {
    const chatId = objectId();
    chats.set(chatId, {
      _id: chatId,
      createdAt: new Date(),
      members: [{ user: userId }, { user: peerId }],
    });
    messages.set(messageId, { _id: messageId, chat: chatId, sender: userId });
  }

  const twoCleanupsStarted = deferred();
  const thirdCleanupStarted = deferred();
  const cleanupMayFinish = deferred();
  let activeCleanups = 0;
  let maxActiveCleanups = 0;
  let cleanupStarts = 0;
  const Message = {
    findById(messageId) {
      return query(messages.get(messageId.toString()) || null);
    },
    async deleteOne({ _id: messageId }) {
      const deleted = messages.delete(messageId.toString());
      return { deletedCount: deleted ? 1 : 0 };
    },
  };
  const Chat = {
    findById(chatId) {
      return query(chats.get(chatId.toString()) || null);
    },
  };
  const app = createJsonApp(
    '/api',
    createMessagesRouter({
      authHelpers,
      chatService: {
        async deleteMessageAttachments() {
          activeCleanups += 1;
          cleanupStarts += 1;
          maxActiveCleanups = Math.max(maxActiveCleanups, activeCleanups);
          if (cleanupStarts === 2) {
            twoCleanupsStarted.resolve();
          }
          if (cleanupStarts === 3) {
            thirdCleanupStarted.resolve();
          }
          await cleanupMayFinish.promise;
          activeCleanups -= 1;
        },
        isChatMember(chatDocument, currentUserId) {
          return chatDocument.members.some((member) => member.user.toString() === currentUserId);
        },
        async prepareMessageAttachmentsForDeletion() {},
        async restoreMessageAttachments() {},
        async syncChatLastMessage() {},
      },
      io: { to: () => ({ emit() {} }) },
      models: { Chat, Message },
      realtime: {
        emitUserEvent() {},
        async runChatOperationExclusive(_chatId, operation) {
          return operation();
        },
      },
    })
  );

  await withServer(app, async (server) => {
    const token = authHelpers.createJwtToken({ sub: userId, username: 'owner' });
    const responsePromises = messageIds.map((messageId) =>
      requestJson(server, {
        method: 'DELETE',
        path: `/api/messages/${messageId}`,
        token,
      })
    );

    await twoCleanupsStarted.promise;
    const responses = await Promise.all(responsePromises);
    assert.deepEqual(responses.map((response) => response.status), [200, 200, 200]);
    assert.equal(cleanupStarts, 2);
    assert.equal(maxActiveCleanups, 2);

    cleanupMayFinish.resolve();
    await thirdCleanupStarted.promise;
    assert.equal(maxActiveCleanups, 2);
  });
});

test('upload route validates payloads and supports local fallback uploads', async () => {
  const authHelpers = makeAuth();
  const userId = objectId();
  const token = authHelpers.createJwtToken({ sub: userId, username: 'uploader' });
  const app = createJsonApp(
    '/api',
    createUploadsRouter({
      authHelpers,
      chatService: {
        async destroyCloudinaryAsset() {},
        async recordPendingUpload({ file }) {
          return { uploadId: objectId(), ...file };
        },
        async releaseUploadQuota() {},
        async reserveUploadQuota(ownerId, bytes) {
          return { ownerId, bytes, dailyWindowStart: new Date() };
        },
        async uploadToCloudinary() {
          throw new Error('Cloudinary should not be used in fallback mode.');
        },
      },
      config: {
        cloudName: '',
        apiKey: '',
        apiSecret: '',
        allowDataUrlFallback: true,
      },
    })
  );

  await withServer(app, async (server) => {
    const invalidResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/uploads',
      token,
      body: {
        fileName: 'notes.txt',
        dataUrl: 'not-a-data-url',
      },
    });

    assert.equal(invalidResponse.status, 400);

    const unsupportedResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/uploads',
      token,
      body: {
        fileName: 'unsafe.html',
        dataUrl: 'data:text/html;base64,PGgxPkJhZDwvaDE+',
      },
    });

    assert.equal(unsupportedResponse.status, 415);

    const uploadResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/uploads',
      token,
      body: {
        fileName: 'pixel.png',
        dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      },
    });

    assert.equal(uploadResponse.status, 201);
    assert.equal(uploadResponse.body.fallback, true);
    assert.equal(uploadResponse.body.file.resourceType, 'image');
    assert.equal(uploadResponse.body.file.fileName, 'pixel.png');
    assert.match(uploadResponse.body.file.uploadId, /^[a-f0-9]{24}$/);
  });
});

test('an ambiguous Cloudinary timeout keeps the durable intent for delayed reconciliation', async () => {
  const authHelpers = makeAuth();
  const userId = objectId();
  const uploadId = objectId();
  const token = authHelpers.createJwtToken({ sub: userId, username: 'uploader' });
  const calls = [];
  const app = createJsonApp(
    '/api',
    createUploadsRouter({
      authHelpers,
      chatService: {
        async completeCloudinaryUpload() {
          throw new Error('Upload completion should not run after a timeout.');
        },
        async createCloudinaryUploadIntent() {
          calls.push('create-intent');
          return {
            uploadId,
            publicId: `confabulate/${userId}/server-id`,
            resourceType: 'image',
          };
        },
        async discardUploadAsset({ uploadId: discardedUploadId, ownerId }) {
          calls.push('discard-intent');
          assert.equal(discardedUploadId, uploadId);
          assert.equal(ownerId, userId);
          return true;
        },
        async recordPendingUpload() {
          throw new Error('Fallback upload should not run.');
        },
        async releaseUploadQuota() {
          calls.push('direct-quota-release');
        },
        async reserveUploadQuota(ownerId, bytes, { reservationId }) {
          calls.push('reserve-quota');
          assert.equal(ownerId, userId);
          assert.equal(bytes, 8);
          assert.equal(reservationId, uploadId);
          return { ownerId: userId, bytes, reservationId, dailyWindowStart: new Date() };
        },
        async uploadToCloudinary({ publicId }) {
          calls.push('upload');
          assert.equal(publicId, `confabulate/${userId}/server-id`);
          const error = new Error('Cloudinary request timed out.');
          error.code = 'CLOUDINARY_UPLOAD_AMBIGUOUS';
          throw error;
        },
      },
      config: {
        cloudName: 'trusted-cloud',
        apiKey: 'api-key',
        apiSecret: 'api-secret',
        allowDataUrlFallback: false,
      },
    })
  );

  await withServer(app, async (server) => {
    const response = await requestJson(server, {
      method: 'POST',
      path: '/api/uploads',
      token,
      body: {
        fileName: 'pixel.png',
        dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      },
    });

    assert.equal(response.status, 502);
    assert.deepEqual(calls, ['create-intent', 'reserve-quota', 'upload']);
  });
});

test('socket message sending persists messages and emits delivery status', async () => {
  const authHelpers = makeAuth();
  const senderId = objectId();
  const recipientId = objectId();
  const chatId = objectId();
  const uploadId = objectId();
  const token = authHelpers.createJwtToken({ sub: senderId, username: 'sender' });
  const roomEvents = [];
  const clientEvents = [];
  const socketHandlers = {};
  const chat = {
    _id: chatId,
    members: [{ user: senderId }, { user: recipientId }],
  };
  let savedMessage = null;
  let chatUpdate = null;

  const io = {
    sockets: {
      sockets: new Map(),
    },
    use(handler) {
      this.middleware = handler;
    },
    on(eventName, handler) {
      if (eventName === 'connection') {
        this.connectionHandler = handler;
      }
    },
    emit(eventName, payload) {
      roomEvents.push({ room: null, eventName, payload });
    },
    to(room) {
      return {
        emit(eventName, payload) {
          roomEvents.push({ room, eventName, payload });
        },
      };
    },
  };

  const socket = {
    id: 'socket-1',
    connected: true,
    data: {},
    handshake: {
      auth: { token },
      headers: {},
    },
    join(room) {
      this.rooms = this.rooms || [];
      this.rooms.push(room);
    },
    emit(eventName, payload) {
      clientEvents.push({ eventName, payload });
    },
    on(eventName, handler) {
      socketHandlers[eventName] = handler;
    },
    to(room) {
      return {
        emit(eventName, payload) {
          roomEvents.push({ room, eventName, payload });
        },
      };
    },
  };

  const Chat = {
    find() {
      return query([{ _id: chatId }]);
    },
    async findById(id) {
      return id === chatId ? chat : null;
    },
    async findByIdAndUpdate(id, update) {
      chatUpdate = { id, update };
    },
    async updateOne(_filters, update) {
      chat.lastReadUpdate = update;
    },
  };

  const Message = {
    async create(data) {
      savedMessage = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return savedMessage;
    },
    findById(id) {
      const sender = { _id: senderId, username: 'sender', isOnline: true, lastSeen: null };
      return query(id?.toString() === savedMessage?._id?.toString() ? { ...savedMessage, sender } : null);
    },
    async findByIdAndUpdate(id, update) {
      assert.equal(id.toString(), savedMessage._id.toString());
      applyAddToSet(savedMessage, update.$addToSet || {});
      return savedMessage;
    },
    findOne() {
      return query(null);
    },
  };

  const User = {
    async findByIdAndUpdate() {},
  };

  registerChatSocketHandlers({
    authHelpers,
    chatService: {
      async claimPendingAttachments({ attachments, messageId: claimedMessageId, ownerId }) {
        assert.deepEqual(attachments, [
          { uploadId, url: 'https://attacker.example/ignored.png', fileName: 'ignored.png' },
        ]);
        assert.match(claimedMessageId.toString(), /^[a-f0-9]{24}$/);
        assert.equal(ownerId, senderId);

        return [
          {
            uploadId,
            url: 'https://res.cloudinary.com/example/image/upload/v1/file.png',
            secureUrl: 'https://res.cloudinary.com/example/image/upload/v1/file.png',
            publicId: 'file',
            fileName: 'file.png',
            resourceType: 'image',
            bytes: 100,
            format: 'png',
          },
        ];
      },
      async finalizeMessageAttachments() {},
      idList(values = []) {
        return values.map((value) => value.toString());
      },
      isChatMember(chatDocument, userId) {
        return chatDocument.members.some((member) => member.user.toString() === userId);
      },
      async markMessagesDelivered() {
        return [];
      },
      async markMessagesSeen() {
        return [];
      },
      async releaseMessageAttachments() {},
      serializeMessage(message) {
        return {
          id: message._id.toString(),
          chatId: message.chat.toString(),
          sender: serializeUser(message.sender),
          text: message.text,
          attachments: message.attachments,
          deliveredTo: message.deliveredTo.map(String),
          seenBy: message.seenBy.map(String),
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        };
      },
    },
    io,
    models: { Chat, Message, User },
    realtime: {
      addUserSocket() {},
      isUserActiveInChat(userId, activeChatId) {
        return userId === recipientId && activeChatId === chatId;
      },
      isUserOnline(userId) {
        return userId === recipientId;
      },
      removeUserSocket() {},
    },
  });

  io.sockets.sockets.set(socket.id, socket);

  await new Promise((resolve, reject) => {
    io.middleware(socket, (error) => (error ? reject(error) : resolve()));
  });

  await io.connectionHandler(socket);

  const sendResponse = await new Promise((resolve) => {
    socketHandlers['message:send'](
      {
        chatId,
        clientMessageId: 'routes-socket-message-0001',
        text: '  Hello team  ',
        attachments: [
          { uploadId, url: 'https://attacker.example/ignored.png', fileName: 'ignored.png' },
        ],
      },
      resolve
    );
  });

  assert.equal(sendResponse.ok, true);
  assert.equal(sendResponse.message.text, 'Hello team');
  assert.equal(savedMessage.text, 'Hello team');
  assert.equal(savedMessage.attachments[0].uploadId, uploadId);
  assert.equal(
    savedMessage.attachments[0].url,
    'https://res.cloudinary.com/example/image/upload/v1/file.png'
  );
  assert.deepEqual(savedMessage.deliveredTo.map(String).sort(), [recipientId, senderId].sort());
  assert.deepEqual(savedMessage.seenBy.map(String).sort(), [recipientId, senderId].sort());
  assert.equal(chatUpdate.id, chatId);
  assert.equal(roomEvents.some((event) => event.room === `chat:${chatId}` && event.eventName === 'message:new'), true);
  assert.equal(roomEvents.some((event) => event.room === `chat:${chatId}` && event.eventName === 'message:status'), true);
  assert.equal(clientEvents.some((event) => event.eventName === 'chat:list:refresh'), true);

  const acceptedMessage = savedMessage;
  const unsafeSendResponse = await new Promise((resolve) => {
    socketHandlers['message:send'](
      {
        chatId,
        clientMessageId: 'routes-socket-unsafe-0001',
        text: 'unsafe',
        attachments: [{ url: 'javascript:alert(1)', fileName: 'unsafe.html' }],
      },
      resolve
    );
  });

  assert.equal(unsafeSendResponse.error, 'One or more attachments are not allowed.');
  assert.strictEqual(savedMessage, acceptedMessage);
});

function applyAddToSet(target, valuesByField) {
  Object.entries(valuesByField).forEach(([field, value]) => {
    const values = value && Array.isArray(value.$each) ? value.$each : [value];
    const existingValues = new Set((target[field] || []).map(String));

    values.forEach((item) => {
      if (!existingValues.has(item.toString())) {
        target[field].push(item);
        existingValues.add(item.toString());
      }
    });
  });
}
