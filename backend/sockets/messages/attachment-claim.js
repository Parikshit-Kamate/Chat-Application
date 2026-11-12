const mongoose = require('mongoose');

function supportsAttachments(chatService) {
  return typeof chatService.claimPendingAttachments === 'function' &&
    typeof chatService.finalizeMessageAttachments === 'function' &&
    typeof chatService.releaseMessageAttachments === 'function';
}

function createAttachmentClaim({ chatService, userId }, rawAttachments) {
  const { claimPendingAttachments, finalizeMessageAttachments, releaseMessageAttachments } = chatService;
  const messageId = new mongoose.Types.ObjectId();
  let attachments = [];

  async function claim() {
    if (rawAttachments.length > 0) {
      attachments = await claimPendingAttachments({
        attachments: rawAttachments,
        messageId,
        ownerId: userId,
      });
    }
    return attachments;
  }

  async function finalize() {
    if (attachments.length === 0) {
      return;
    }
    try {
      await finalizeMessageAttachments({ messageId, ownerId: userId });
    } catch (error) {
      console.error('Message attachment finalization error:', error);
    }
  }

  async function release() {
    if (rawAttachments.length === 0) {
      return;
    }
    try {
      await releaseMessageAttachments({ messageId, ownerId: userId });
    } catch (error) {
      console.error('Message attachment release error:', error);
    }
  }

  return { messageId, claim, finalize, release };
}

module.exports = { supportsAttachments, createAttachmentClaim };
