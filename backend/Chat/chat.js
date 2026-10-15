const mongoose = require('mongoose');

const chatMemberSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    lastReadAt: {
      type: Date,
      default: () => new Date(0),
    },
  },
  {
    _id: false,
  }
);

const chatSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['direct', 'group'],
      required: true,
    },
    name: {
      type: String,
      trim: true,
      default: '',
      maxlength: 60,
    },
    pairKey: {
      type: String,
      trim: true,
      maxlength: 49,
    },
    members: {
      type: [chatMemberSchema],
      default: [],
    },
    admins: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

chatSchema.index({ type: 1, 'members.user': 1 });
chatSchema.index({ 'members.user': 1, updatedAt: -1 });
chatSchema.index(
  { pairKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: 'direct',
      pairKey: { $type: 'string' },
    },
  }
);

module.exports = mongoose.model('Chat', chatSchema);
