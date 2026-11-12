const { normalizeObjectId } = require('../object-id');
const mongoose = require('mongoose');
const { createCodedError } = require('./create-coded-error');

function createReserveUploadQuota({ requireUploadModels, resolvedUploadLimits, getUtcDayStart, UploadQuota }) {
  return async function reserveUploadQuota(ownerId, bytes, { reservationId } = {}) {
    requireUploadModels();
    const normalizedOwnerId = normalizeObjectId(ownerId);
    const normalizedReservationId = normalizeObjectId(reservationId);
    const normalizedBytes = Number(bytes);
    if (!normalizedOwnerId || !normalizedReservationId || !Number.isSafeInteger(normalizedBytes) || normalizedBytes < 1) {
      throw createCodedError('Invalid upload quota request.', 'INVALID_UPLOAD');
    }
    const reservationObjectId = new mongoose.Types.ObjectId(normalizedReservationId);
    if (normalizedBytes > resolvedUploadLimits.dailyMaxBytes || normalizedBytes > resolvedUploadLimits.totalMaxBytes) {
      throw createCodedError('This file exceeds your upload quota.', 'UPLOAD_QUOTA_EXCEEDED');
    }
    const dailyWindowStart = getUtcDayStart();
    try {
      await UploadQuota.updateOne({ owner: normalizedOwnerId }, {
        $setOnInsert: {
          owner: normalizedOwnerId,
          totalFiles: 0,
          totalBytes: 0,
          dailyWindowStart,
          dailyFiles: 0,
          dailyBytes: 0,
          reservations: []
        }
      }, { upsert: true });
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }
    await UploadQuota.updateOne(
      { owner: normalizedOwnerId, dailyWindowStart: { $lt: dailyWindowStart } },
      { $set: { dailyWindowStart, dailyFiles: 0, dailyBytes: 0 } }
    );
    const quota = await UploadQuota.findOneAndUpdate({
      owner: normalizedOwnerId,
      dailyWindowStart,
      dailyFiles: { $lt: resolvedUploadLimits.dailyMaxFiles },
      dailyBytes: { $lte: resolvedUploadLimits.dailyMaxBytes - normalizedBytes },
      totalFiles: { $lt: resolvedUploadLimits.totalMaxFiles },
      totalBytes: { $lte: resolvedUploadLimits.totalMaxBytes - normalizedBytes },
      reservations: { $ne: reservationObjectId }
    }, {
      $addToSet: { reservations: reservationObjectId },
      $inc: { dailyFiles: 1, dailyBytes: normalizedBytes, totalFiles: 1, totalBytes: normalizedBytes }
    }, { new: true });
    if (!quota) {
      throw createCodedError('Upload quota exceeded.', 'UPLOAD_QUOTA_EXCEEDED');
    }
    return {
      ownerId: normalizedOwnerId,
      bytes: normalizedBytes,
      dailyWindowStart,
      reservationId: normalizedReservationId
    };
  };
}

module.exports = createReserveUploadQuota;
