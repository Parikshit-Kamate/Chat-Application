function createReconcileUploadCandidate({ Message, UploadAsset, restoreMessageAttachments }) {
  async function reconcileUploadCandidate(candidate, now) {
    if (candidate.status === 'claiming') {
      try {
        const messageExists = await Message.exists({
          _id: candidate.message,
          sender: candidate.owner,
          'attachments.uploadId': candidate._id
        });
        if (messageExists) {
          await UploadAsset.updateOne({ _id: candidate._id, status: 'claiming', message: candidate.message }, {
            $set: { status: 'attached', attachedAt: now },
            $unset: { claimStartedAt: '', pendingExpiresAt: '' }
          });
          return 'preserved';
        }
      } catch (error) {
        console.error('Attachment claim reconciliation failed:', error.message);
        return 'failed';
      }
    }
    if (candidate.status === 'deleting' && candidate.message) {
      try {
        const messageExists = await Message.exists({ _id: candidate.message });
        if (messageExists) {
          await restoreMessageAttachments({ messageId: candidate.message, ownerId: candidate.owner });
          return 'preserved';
        }
      } catch (error) {
        console.error('Message deletion reconciliation failed:', error.message);
        return 'failed';
      }
    }
    return 'delete';
  }
  return reconcileUploadCandidate;
}

module.exports = createReconcileUploadCandidate;
