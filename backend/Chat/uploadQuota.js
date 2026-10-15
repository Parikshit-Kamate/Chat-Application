const mongoose = require('mongoose');

const uploadQuotaSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    totalFiles: { type: Number, default: 0, min: 0 },
    totalBytes: { type: Number, default: 0, min: 0 },
    dailyWindowStart: { type: Date, required: true },
    dailyFiles: { type: Number, default: 0, min: 0 },
    dailyBytes: { type: Number, default: 0, min: 0 },
    reservations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UploadAsset',
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('UploadQuota', uploadQuotaSchema);
