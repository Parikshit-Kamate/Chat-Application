const mongoose = require('mongoose');

const uploadAssetSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: {
      type: String,
      enum: ['cloudinary', 'data-url'],
      required: true,
    },
    status: {
      type: String,
      enum: ['uploading', 'pending', 'claiming', 'attached', 'deleting'],
      default: 'pending',
      required: true,
      index: true,
    },
    url: { type: String, default: '', maxlength: 180000 },
    secureUrl: { type: String, default: '', maxlength: 2048 },
    publicId: { type: String, default: '', maxlength: 255 },
    fileName: { type: String, default: '', maxlength: 180 },
    mediaType: { type: String, required: true, maxlength: 100 },
    resourceType: { type: String, enum: ['image', 'raw'], required: true },
    bytes: { type: Number, required: true, min: 1, max: 10 * 1024 * 1024 },
    format: { type: String, default: '', maxlength: 40 },
    message: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
      index: true,
    },
    attachedAt: { type: Date, default: null },
    claimStartedAt: { type: Date, default: null },
    deletionStartedAt: { type: Date, default: null },
    pendingExpiresAt: { type: Date, required: true, index: true },
  },
  {
    timestamps: true,
  }
);

uploadAssetSchema.index({ owner: 1, status: 1, createdAt: -1 });
uploadAssetSchema.index({ status: 1, pendingExpiresAt: 1 });

module.exports = mongoose.model('UploadAsset', uploadAssetSchema);
