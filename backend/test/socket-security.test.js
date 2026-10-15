const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const { createAuthHelpers } = require('../lib/auth');
const { registerChatSocketHandlers } = require('../sockets/register-chat-socket-handlers');

function objectId() {
  return new mongoose.Types.ObjectId().toString();
}

function query(value) {
  return {
    select() {
      return this;
    },
    populate() {
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

function createSocketHarness({ chatLookupError = null } = {}) {
  const authHelpers = createAuthHelpers({
    jwtSecret: 'socket-security-test-secret',
    jwtExpiresInSeconds: 60 * 60,
  });
  const userId = objectId();
  const peerId = objectId();
  const outsiderId = objectId();
  const chatId = objectId();
  const token = authHelpers.createJwtToken({ sub: userId, username: 'socket-user' });
  const socketHandlers = {};
  const roomEvents = [];
  const directEvents = [];
  const presenceEvents = [];
  const disconnectCalls = [];
  const onlineSocketIds = new Set();
  const chat = {
    _id: chatId,
    members: [{ user: userId }, { user: peerId }],
  };

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
    id: 'security-socket-1',
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
      directEvents.push({ eventName, payload });
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
    disconnect(force) {
      disconnectCalls.push(force);
      this.connected = false;

      if (socketHandlers.disconnect) {
        this.disconnectCleanup = Promise.resolve(socketHandlers.disconnect('server namespace disconnect'));
      }
    },
  };

  const Chat = {
    find() {
      return query([chat]);
    },
    findById(id) {
      if (chatLookupError) {
        return {
          select() {
            return Promise.reject(chatLookupError);
          },
          then(resolve, reject) {
            return Promise.reject(chatLookupError).then(resolve, reject);
          },
        };
      }

      return query(id === chatId ? chat : null);
    },
    async findByIdAndUpdate() {},
    async updateOne() {},
  };

  const Message = {
    async create() {
      throw new Error('Message creation is not expected in these tests.');
    },
    findById() {
      return query(null);
    },
    async findByIdAndUpdate() {
      return null;
    },
    findOne() {
      return query(null);
    },
    async findOneAndUpdate() {
      return null;
    },
  };

  const User = {
    async findByIdAndUpdate() {},
  };

  registerChatSocketHandlers({
    authHelpers,
    chatService: {
      idList(values = []) {
        return values.map((value) => value.toString());
      },
      isChatMember(chatDocument, currentUserId) {
        return (chatDocument.members || []).some((member) => member.user.toString() === currentUserId);
      },
      async markMessagesDelivered() {
        return [];
      },
      async markMessagesSeen() {
        return [];
      },
      normalizeAttachment(attachment) {
        return attachment;
      },
      serializeMessage(message) {
        return message;
      },
    },
    io,
    models: { Chat, Message, User },
    realtime: {
      addUserSocket(_userId, socketId) {
        onlineSocketIds.add(socketId);
      },
      emitUserEvent(userIds, eventName, payload) {
        presenceEvents.push({ userIds: userIds.map(String), eventName, payload });
      },
      isUserActiveInChat() {
        return false;
      },
      getLiveSocketIdsForUser() {
        return Array.from(onlineSocketIds);
      },
      isUserOnline() {
        return onlineSocketIds.size > 0;
      },
      removeUserSocket(_userId, socketId) {
        onlineSocketIds.delete(socketId);
      },
    },
  });

  async function authenticate() {
    await new Promise((resolve, reject) => {
      io.middleware(socket, (error) => (error ? reject(error) : resolve()));
    });
  }

  async function connect() {
    await authenticate();
    io.sockets.sockets.set(socket.id, socket);
    await io.connectionHandler(socket);
  }

  return {
    chatId,
    connect,
    authenticate,
    directEvents,
    disconnectCalls,
    io,
    outsiderId,
    peerId,
    presenceEvents,
    roomEvents,
    socket,
    socketHandlers,
    userId,
  };
}

test('socket guards normalize malformed payloads and acknowledgement arguments', async () => {
  const harness = createSocketHarness();
  await harness.connect();

  await assert.doesNotReject(() => harness.socketHandlers['chat:close'](null, 'not-a-function'));
  await assert.doesNotReject(() => harness.socketHandlers['typing:start'](null, 'not-a-function'));
  await assert.doesNotReject(() => harness.socketHandlers['typing:stop'](null));
  await assert.doesNotReject(() => harness.socketHandlers['chat:open'](null, 'not-a-function'));

  const response = await new Promise((resolve) => {
    harness.socketHandlers['chat:open'](null, resolve);
  });

  assert.equal(response.error, 'Invalid chat ID.');
});

test('socket guard catches rejected async event handlers', async () => {
  const harness = createSocketHarness({ chatLookupError: new Error('database unavailable') });
  await harness.connect();

  await assert.doesNotReject(() => harness.socketHandlers['typing:start']({ chatId: harness.chatId }));
});

test('socket event rate limiter rejects message floods before database work', async () => {
  const harness = createSocketHarness();
  await harness.connect();
  const responses = [];

  for (let index = 0; index < 14; index += 1) {
    const response = await new Promise((resolve) => {
      harness.socketHandlers['message:send']({ chatId: 'invalid-chat-id', text: 'flood' }, resolve);
    });
    responses.push(response);
  }

  assert.equal(responses[0].error, 'Invalid chat ID.');
  assert.equal(
    responses.some((response) => response.code === 'RATE_LIMITED'),
    true
  );
});

test('socket authentication expiry rejects events and disconnects the socket', async () => {
  const harness = createSocketHarness();
  await harness.connect();

  assert.equal(Number.isFinite(harness.socket.data.authExpiresAtMs), true);
  harness.socket.data.authExpiresAtMs = Date.now() - 1;

  const response = await new Promise((resolve) => {
    harness.socketHandlers['chat:open']({ chatId: harness.chatId }, resolve);
  });

  assert.equal(response.code, 'AUTH_EXPIRED');
  assert.deepEqual(harness.disconnectCalls, [true]);
});

test('socket authentication expiry timer disconnects at the retained deadline', async () => {
  const harness = createSocketHarness();
  await harness.authenticate();
  harness.socket.data.authExpiresAtMs = Date.now() + 25;
  await harness.io.connectionHandler(harness.socket);

  await new Promise((resolve) => setTimeout(resolve, 75));

  assert.deepEqual(harness.disconnectCalls, [true]);
  await harness.socket.disconnectCleanup;
});

test('presence updates are scoped to current chat co-members', async () => {
  const harness = createSocketHarness();
  await harness.connect();

  assert.deepEqual(harness.presenceEvents[0].userIds, [harness.peerId]);
  assert.equal(harness.presenceEvents[0].eventName, 'presence:update');
  assert.equal(harness.presenceEvents[0].payload.isOnline, true);
  assert.equal(harness.presenceEvents[0].userIds.includes(harness.outsiderId), false);
  assert.equal(
    harness.roomEvents.some((event) => event.room === null && event.eventName === 'presence:update'),
    false
  );

  await harness.socketHandlers.disconnect('client namespace disconnect');

  assert.deepEqual(harness.presenceEvents[1].userIds, [harness.peerId]);
  assert.equal(harness.presenceEvents[1].payload.isOnline, false);
});
