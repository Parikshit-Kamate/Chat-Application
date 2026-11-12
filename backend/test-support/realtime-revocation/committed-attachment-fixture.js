const { objectId, query } = require('./query');
const { registerHarness } = require('./harness');

async function createCommittedAttachmentFixture() {
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
  return { chatId, uploadId, harness, getFinalizeCalls: () => finalizeCalls, getReleaseCalls: () => releaseCalls };
}

module.exports = { createCommittedAttachmentFixture };
