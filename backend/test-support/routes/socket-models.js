const assert = require('node:assert/strict');
const { query } = require('./query');

function createSendModels({ state, chatId, chat, senderId }) {
  const Chat = {
    find() {
      return query([{ _id: chatId }]);
    },
    async findById(id) {
      return id === chatId ? chat : null;
    },
    async findByIdAndUpdate(id, update) {
      state.chatUpdate = { id, update };
    },
    async updateOne(_filters, update) {
      chat.lastReadUpdate = update;
    },
  };

  const Message = {
    async create(data) {
      state.savedMessage = {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return state.savedMessage;
    },
    findById(id) {
      const sender = { _id: senderId, username: 'sender', isOnline: true, lastSeen: null };
      return query(id?.toString() === state.savedMessage?._id?.toString() ? { ...state.savedMessage, sender } : null);
    },
    async findByIdAndUpdate(id, update) {
      assert.equal(id.toString(), state.savedMessage._id.toString());
      applyAddToSet(state.savedMessage, update.$addToSet || {});
      return state.savedMessage;
    },
    findOne() {
      return query(null);
    },
  };

  const User = {
    async findByIdAndUpdate() {},
  };
  return { Chat, Message, User };
}

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

module.exports = { createSendModels };
