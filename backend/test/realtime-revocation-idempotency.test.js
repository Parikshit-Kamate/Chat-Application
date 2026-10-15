const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const { createRealtimeHelpers } = require('../lib/realtime');
const { registerChatSocketHandlers } = require('../sockets/register-chat-socket-handlers');

function objectId() {
  return new mongoose.Types.ObjectId().toString();
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function query(value) {
  return {
    limit() {
      return this;
    },
    populate() {
      return this;
    },
    select() {
      return this;
    },
    then(resolve, reject) {
      return Promise.resolve(value).then(resolve, reject);
    },
  };
}

function createIoAndSocket({ userId, username = 'sender' }) {
  const socketHandlers = {};
  const emittedEvents = [];
  const joinedRooms = new Set();
  const leftRooms = [];
  const socket = {
    id: `socket-${userId}`,
    connected: true,
    data: {
      activeChatId: null,
      authExpiresAtMs: Date.now() + 60_000,
      userId,
      username,
    },
    disconnect() {
      this.connected = false;
    },
    emit(eventName, payload) {
      emittedEvents.push({ eventName, payload, room: this.id });
    },
    join(roomName) {
      joinedRooms.add(roomName);
    },
    leave(roomName) {
      leftRooms.push(roomName);
      joinedRooms.delete(roomName);
    },
    on(eventName, handler) {
      socketHandlers[eventName] = handler;
    },
    to(roomName) {
      return {
        emit(eventName, payload) {
          emittedEvents.push({ eventName, payload, room: roomName });
        },
      };
    },
  };
  const io = {
    sockets: {
      sockets: new Map([[socket.id, socket]]),
    },
    on(eventName, handler) {
      if (eventName === 'connection') {
        this.connectionHandler = handler;
      }
    },
    to(roomName) {
      return {
        emit(eventName, payload) {
          emittedEvents.push({ eventName, payload, room: roomName });
        },
      };
    },
    use(handler) {
      this.middleware = handler;
    },
  };

  return {
    emittedEvents,
    io,
    joinedRooms,
    leftRooms,
    socket,
    socketHandlers,
  };
}

function createChatServiceStub() {
  return {
    idList(values = []) {
      return values.map(String);
    },
    isChatMember(chat, userId) {
      return (chat.members || []).some((member) => member.user.toString() === userId);
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
      if (!message) {
        return null;
      }

      const senderId = message.sender?._id?.toString?.() || message.sender?.toString?.() || '';
      return {
        id: message._id.toString(),
        chatId: message.chat.toString(),
        sender: { id: senderId },
        text: message.text,
        attachments: message.attachments || [],
        deliveredTo: (message.deliveredTo || []).map(String),
        seenBy: (message.seenBy || []).map(String),
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      };
    },
  };
}

function registerHarness({ Chat, Message, User, chatServiceOverrides = {}, userId }) {
  const transport = createIoAndSocket({ userId });
  const realtime = createRealtimeHelpers(transport.io);

  registerChatSocketHandlers({
    authHelpers: {
      getBearerToken() {
        return '';
      },
      verifyJwtToken() {
        throw new Error('Authentication middleware is not used by this harness.');
      },
    },
    chatService: { ...createChatServiceStub(), ...chatServiceOverrides },
    io: transport.io,
    models: { Chat, Message, User },
    realtime,
  });

  return { ...transport, realtime };
}

test('a removal during socket setup prevents a stale membership result from rejoining the room', async () => {
  const userId = objectId();
  const peerId = objectId();
  const chatId = objectId();
  const staleChat = {
    _id: chatId,
    members: [{ user: userId }, { user: peerId }],
  };
  const chatQuery = deferred();
  const queryStarted = deferred();
  const Chat = {
    find() {
      queryStarted.resolve();
      return query(chatQuery.promise);
    },
  };
  const harness = registerHarness({
    Chat,
    Message: {},
    User: { async findByIdAndUpdate() {} },
    userId,
  });

  const connectionPromise = harness.io.connectionHandler(harness.socket);
  await queryStarted.promise;
  await harness.realtime.leaveUserSocketsFromChat(userId, chatId);
  chatQuery.resolve([staleChat]);
  await connectionPromise;

  assert.equal(harness.joinedRooms.has(`chat:${chatId}`), false);
  assert.equal(harness.socket.data.revokedChatIds.has(chatId), true);
  assert.deepEqual(harness.leftRooms, [`chat:${chatId}`]);
});

test('a send queued behind member removal rechecks membership before persisting', async () => {
  const userId = objectId();
  const peerId = objectId();
  const chatId = objectId();
  const chat = {
    _id: chatId,
    members: [{ user: userId }, { user: peerId }],
  };
  let createCalls = 0;
  const Chat = {
    find() {
      return query([chat]);
    },
    findById() {
      return query(chat);
    },
  };
  const Message = {
    async create() {
      createCalls += 1;
      return null;
    },
    findOne() {
      return query(null);
    },
  };
  const harness = registerHarness({
    Chat,
    Message,
    User: { async findByIdAndUpdate() {} },
    userId,
  });
  await harness.io.connectionHandler(harness.socket);

  const removalMayFinish = deferred();
  const removalStarted = deferred();
  const removalPromise = harness.realtime.runChatOperationExclusive(chatId, async () => {
    removalStarted.resolve();
    await removalMayFinish.promise;
    chat.members = [{ user: peerId }];
  });
  await removalStarted.promise;

  const responsePromise = new Promise((resolve) => {
    harness.socketHandlers['message:send'](
      {
        chatId,
        clientMessageId: 'send-after-removal-0001',
        text: 'must not persist',
      },
      resolve
    );
  });

  removalMayFinish.resolve();
  await removalPromise;
  const response = await responsePromise;

  assert.equal(response.error, 'Chat not found.');
  assert.equal(createCalls, 0);
  assert.equal(
    harness.emittedEvents.some((event) => event.eventName === 'message:new'),
    false
  );
});

test('message retries reuse one persisted message and post-persistence metadata failures still acknowledge success', async () => {
  const userId = objectId();
  const peerId = objectId();
  const chatId = objectId();
  const messages = new Map();
  const chat = {
    _id: chatId,
    members: [{ user: userId }, { user: peerId }],
  };
  let metadataUpdateCalls = 0;
  const Chat = {
    find() {
      return query([chat]);
    },
    findById() {
      return query(chat);
    },
    async findByIdAndUpdate() {
      metadataUpdateCalls += 1;
      throw new Error('simulated metadata update failure');
    },
    async updateOne() {},
  };
  const Message = {
    async create(data) {
      const existingMessage = Array.from(messages.values()).find(
        (message) =>
          message.sender.toString() === data.sender.toString() &&
          message.clientMessageId === data.clientMessageId
      );
      if (existingMessage) {
        const error = new Error('duplicate key');
        error.code = 11000;
        throw error;
      }

      const id = objectId();
      const now = new Date();
      const message = {
        ...data,
        _id: id,
        createdAt: now,
        updatedAt: now,
      };
      messages.set(id, message);
      return message;
    },
    findById(id) {
      return query(messages.get(id.toString()) || null);
    },
    async findByIdAndUpdate(id) {
      return messages.get(id.toString()) || null;
    },
    findOne(filters) {
      if (filters?.clientMessageId) {
        return query(
          Array.from(messages.values()).find(
            (message) =>
              message.sender.toString() === filters.sender.toString() &&
              message.clientMessageId === filters.clientMessageId
          ) || null
        );
      }

      return query(null);
    },
  };
  const harness = registerHarness({
    Chat,
    Message,
    User: { async findByIdAndUpdate() {} },
    userId,
  });
  await harness.io.connectionHandler(harness.socket);

  const payload = {
    chatId,
    clientMessageId: 'retry-safe-message-0001',
    text: 'send once',
  };
  const firstResponse = await new Promise((resolve) => {
    harness.socketHandlers['message:send'](payload, resolve);
  });
  const secondResponse = await new Promise((resolve) => {
    harness.socketHandlers['message:send'](payload, resolve);
  });
  const changedDraftResponse = await new Promise((resolve) => {
    harness.socketHandlers['message:send']({ ...payload, text: 'edited after retry' }, resolve);
  });

  assert.equal(firstResponse.ok, true);
  assert.equal(secondResponse.ok, true);
  assert.equal(secondResponse.duplicate, true);
  assert.equal(changedDraftResponse.code, 'CLIENT_MESSAGE_ID_CONFLICT');
  assert.equal(messages.size, 1);
  assert.equal(metadataUpdateCalls, 1);
  assert.equal(
    harness.emittedEvents.filter((event) => event.eventName === 'message:new').length,
    1
  );
});

test('a message committed before an acknowledgement error keeps and finalizes its claimed attachments', async () => {
  const userId = objectId();
  const peerId = objectId();
  const chatId = objectId();
  const uploadId = objectId();
  const chat = {
    _id: chatId,
    members: [{ user: userId }, { user: peerId }],
  };
  let storedMessage = null;
  let finalizeCalls = 0;
  let releaseCalls = 0;
  const Chat = {
    find() {
      return query([chat]);
    },
    findById() {
      return query(chat);
    },
    async findByIdAndUpdate() {},
    async updateOne() {},
  };
  const Message = {
    async create(data) {
      const now = new Date();
      storedMessage = { ...data, createdAt: now, updatedAt: now };
      throw new Error('simulated acknowledgement loss');
    },
    findById(id) {
      return query(id.toString() === storedMessage?._id.toString() ? storedMessage : null);
    },
    findOne(filters) {
      if (filters?._id && storedMessage?._id.toString() === filters._id.toString()) {
        return query(storedMessage);
      }

      return query(null);
    },
  };
  const harness = registerHarness({
    Chat,
    Message,
    User: { async findByIdAndUpdate() {} },
    chatServiceOverrides: {
      async claimPendingAttachments({ messageId }) {
        return [
          {
            uploadId,
            url: 'data:image/png;base64,iVBORw0KGgo=',
            secureUrl: '',
            publicId: '',
            fileName: 'pixel.png',
            resourceType: 'image',
            bytes: 8,
            format: '',
            messageId,
          },
        ];
      },
      async finalizeMessageAttachments() {
        finalizeCalls += 1;
      },
      async releaseMessageAttachments() {
        releaseCalls += 1;
      },
    },
    userId,
  });
  await harness.io.connectionHandler(harness.socket);

  const response = await new Promise((resolve) => {
    harness.socketHandlers['message:send'](
      {
        chatId,
        clientMessageId: 'ambiguous-create-message-0001',
        text: 'persist exactly once',
        attachments: [{ uploadId }],
      },
      resolve
    );
  });

  assert.equal(response.ok, true);
  assert.equal(finalizeCalls, 1);
  assert.equal(releaseCalls, 0);
  assert.equal(
    harness.emittedEvents.filter((event) => event.eventName === 'message:new').length,
    1
  );
});
