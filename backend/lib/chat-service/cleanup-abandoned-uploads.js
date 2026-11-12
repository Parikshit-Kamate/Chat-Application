const { MAX_PENDING_UPLOAD_CLEANUP_BATCH } = require('./constants');

function createCleanupAbandonedUploads({
  UploadAsset,
  UploadQuota,
  reconcileUploadCandidate,
  deleteTrackedUploadAsset
}) {
  async function cleanupAbandonedUploads({ now = new Date() } = {}) {
    if (!UploadAsset || !UploadQuota) {
      return { deleted: 0, failed: 0 };
    }
    const staleOperationCutoff = new Date(now.getTime() - 15 * 60 * 1000);
    const candidates = await UploadAsset.find({
      $or: [
        { status: 'pending', pendingExpiresAt: { $lte: now } },
        { status: 'uploading', createdAt: { $lte: staleOperationCutoff } },
        { status: 'claiming', claimStartedAt: { $lte: staleOperationCutoff } },
        { status: 'deleting', deletionStartedAt: { $lte: staleOperationCutoff } }
      ]
    }).sort({ pendingExpiresAt: 1 }).limit(MAX_PENDING_UPLOAD_CLEANUP_BATCH);
    let deleted = 0;
    let failed = 0;
    for (const candidate of candidates) {
      const reconciliation = await reconcileUploadCandidate(candidate, now);
      if (reconciliation !== 'delete') {
        failed += Number(reconciliation === 'failed');
        continue;
      }
      const asset = await UploadAsset.findOneAndUpdate({
        _id: candidate._id,
        $or: [
          { status: 'pending', pendingExpiresAt: { $lte: now } },
          { status: 'uploading', createdAt: { $lte: staleOperationCutoff } },
          { status: 'claiming', claimStartedAt: { $lte: staleOperationCutoff } },
          { status: 'deleting', deletionStartedAt: { $lte: staleOperationCutoff } }
        ]
      }, { $set: { status: 'deleting', deletionStartedAt: now } }, { new: true });
      if (!asset) {
        continue;
      }
      try {
        if (await deleteTrackedUploadAsset(asset, { now })) {
          deleted += 1;
        }
      } catch (error) {
        failed += 1;
        console.error('Pending upload cleanup failed:', error.message);
        await UploadAsset.updateOne({ _id: asset._id, status: 'deleting' }, { $set: { deletionStartedAt: now } });
      }
    }
    return { deleted, failed };
  }
  return cleanupAbandonedUploads;
}

module.exports = createCleanupAbandonedUploads;
