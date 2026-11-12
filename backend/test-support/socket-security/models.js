const { query } = require('./query');

function createModels(chat, chatLookupError) {
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
      return query(id === chat._id ? chat : null);
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
  const User = { async findByIdAndUpdate() {} };
  return { Chat, Message, User };
}

module.exports = { createModels };
