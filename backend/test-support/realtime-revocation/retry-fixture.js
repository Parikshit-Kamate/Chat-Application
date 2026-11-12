const { objectId, query } = require('./query');
const { registerHarness } = require('./harness');

async function createRetryFixture() {
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
  return { chatId, messages, harness, getMetadataUpdateCalls: () => metadataUpdateCalls };
}

module.exports = { createRetryFixture };
