const MAX_CONCURRENT_ATTACHMENT_CLEANUPS = 2;
const MAX_QUEUED_ATTACHMENT_CLEANUPS = 100;

function createAttachmentCleanupQueue({ deleteMessageAttachments }) {
  const attachmentCleanupQueue = [];
  const scheduledAttachmentCleanups = new Set();
  let activeAttachmentCleanups = 0;
  const drainAttachmentCleanupQueue = () => {
    while (activeAttachmentCleanups < MAX_CONCURRENT_ATTACHMENT_CLEANUPS && attachmentCleanupQueue.length > 0) {
      const cleanup = attachmentCleanupQueue.shift();
      activeAttachmentCleanups += 1;
      Promise.resolve().then(() => deleteMessageAttachments({
        messageId: cleanup.messageId,
        ownerId: cleanup.ownerId
      })).catch(error => {
        console.error('Message attachment cleanup scheduling error:', error);
      }).finally(() => {
        activeAttachmentCleanups -= 1;
        scheduledAttachmentCleanups.delete(cleanup.key);
        drainAttachmentCleanupQueue();
      });
    }
  };
  const scheduleAttachmentCleanup = ({ messageId, ownerId }) => {
    const key = `${ownerId}:${messageId}`;
    if (scheduledAttachmentCleanups.has(key)) {
      return true;
    }
    if (attachmentCleanupQueue.length >= MAX_QUEUED_ATTACHMENT_CLEANUPS) {
      console.warn('Attachment cleanup queue is full; durable cleanup will retry it later.');
      return false;
    }
    scheduledAttachmentCleanups.add(key);
    attachmentCleanupQueue.push({ key, messageId, ownerId });
    drainAttachmentCleanupQueue();
    return true;
  };
  return { scheduleAttachmentCleanup };
}

module.exports = createAttachmentCleanupQueue;
