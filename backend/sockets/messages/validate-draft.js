const { normalizeObjectId } = require('../../lib/object-id');
const { normalizeClientMessageId } = require('../security/payload');

function validateDraft(payload) {
  const chatId = normalizeObjectId(payload.chatId);
  const clientMessageId = normalizeClientMessageId(payload.clientMessageId);
  const text = String(payload.text || '').trim();
  const replyToId = normalizeObjectId(payload.replyToId);
  const rawAttachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  const uploadIds = rawAttachments.map((attachment) => normalizeObjectId(attachment?.uploadId));

  if (!chatId) {
    return { error: 'Invalid chat ID.' };
  }
  if (!clientMessageId) {
    return { error: 'Invalid client message ID.' };
  }
  if (rawAttachments.length > 8 || uploadIds.some((uploadId) => !uploadId) ||
    new Set(uploadIds).size !== uploadIds.length) {
    return { error: 'One or more attachments are not allowed.' };
  }
  if (!text && rawAttachments.length === 0) {
    return { error: 'Message cannot be empty.' };
  }
  if (text.length > 5000) {
    return { error: 'Message text is too long.' };
  }
  return { chatId, clientMessageId, text, replyToId, rawAttachments, uploadIds };
}

module.exports = { validateDraft };
