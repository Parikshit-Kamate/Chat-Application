const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pairKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    actedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

friendRequestSchema.index({ requester: 1, status: 1 });
friendRequestSchema.index({ recipient: 1, status: 1 });

module.exports = mongoose.model('FriendRequest', friendRequestSchema);
