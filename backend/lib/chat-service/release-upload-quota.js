const { normalizeObjectId } = require('../object-id');
const mongoose = require('mongoose');

function createReleaseUploadQuota({ UploadQuota }) {
  async function releaseUploadQuota(reservation, { releaseDaily = false } = {}) {
    if (!UploadQuota || !reservation?.ownerId || !reservation?.bytes || !reservation?.reservationId) {
      return false;
    }
    const normalizedReservationId = normalizeObjectId(reservation.reservationId);
    if (!normalizedReservationId) {
      return false;
    }
    const reservationObjectId = new mongoose.Types.ObjectId(normalizedReservationId);
    const updateFields = {
      reservations: {
        $filter: {
          input: { $ifNull: ['$reservations', []] },
          as: 'reservation',
          cond: { $ne: ['$$reservation', reservationObjectId] }
        }
      },
      totalFiles: { $max: [0, { $subtract: ['$totalFiles', 1] }] },
      totalBytes: { $max: [0, { $subtract: ['$totalBytes', reservation.bytes] }] }
    };
    if (releaseDaily) {
      const isSameDailyWindow = { $eq: ['$dailyWindowStart', reservation.dailyWindowStart] };
      updateFields.dailyFiles = {
        $cond: [isSameDailyWindow, { $max: [0, { $subtract: ['$dailyFiles', 1] }] }, '$dailyFiles']
      };
      updateFields.dailyBytes = {
        $cond: [isSameDailyWindow, { $max: [0, { $subtract: ['$dailyBytes', reservation.bytes] }] }, '$dailyBytes']
      };
    }
    const quota = await UploadQuota.findOneAndUpdate({
      owner: reservation.ownerId,
      reservations: reservationObjectId
    }, [{ $set: updateFields }], { new: true });
    return Boolean(quota);
  }
  return releaseUploadQuota;
}

module.exports = createReleaseUploadQuota;
