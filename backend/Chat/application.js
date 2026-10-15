const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema(
  {
    uploadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UploadAsset',
      default: null,
    },
    url: { type: String, required: true, maxlength: 180000 },
    secureUrl: { type: String, default: '', maxlength: 2048 },
    publicId: { type: String, default: '', maxlength: 255 },
    fileName: { type: String, default: '', maxlength: 180 },
    resourceType: { type: String, enum: ['image', 'raw', 'video'], default: 'raw' },
    bytes: { type: Number, default: 0, min: 0, max: 10 * 1024 * 1024 },
    format: { type: String, default: '', maxlength: 40 },
  },
  {
    _id: false,
  }
);

const messageSchema = new mongoose.Schema(
  {
    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Chat',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    clientMessageId: {
      type: String,
      trim: true,
      maxlength: 64,
    },
    text: {
      type: String,
      trim: true,
      default: '',
      maxlength: 5000,
    },
    attachments: {
      type: [attachmentSchema],
      default: [],
      validate: {
        validator: (attachments) => attachments.length <= 8,
        message: 'A message can contain at most 8 attachments.',
      },
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    deliveredTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  }
);

messageSchema.index({ chat: 1, createdAt: -1, _id: -1 });
messageSchema.index(
  { sender: 1, clientMessageId: 1 },
  {
    unique: true,
    partialFilterExpression: { clientMessageId: { $type: 'string' } },
  }
);

module.exports = mongoose.model('Message', messageSchema);
