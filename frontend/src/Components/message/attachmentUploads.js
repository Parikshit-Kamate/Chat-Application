export const MAX_PENDING_ATTACHMENTS = 8;
export const MAX_FILES_PER_SELECTION = 5;
export const MAX_ATTACHMENT_FILE_BYTES = 10 * 1024 * 1024;

export function createAttachmentReferences(attachments) {
  return Array.from(attachments || []).map((attachment) => ({
    uploadId: String(attachment?.uploadId || '').trim(),
  }));
}

export async function uploadAttachmentBatch({
  files,
  availableSlots,
  uploadFile,
  onUploaded = () => {},
  onRejected = () => {},
  onOversized = () => {},
}) {
  if (typeof uploadFile !== 'function') {
    throw new TypeError('uploadFile must be a function.');
  }

  const slotLimit = Math.max(0, Math.floor(Number(availableSlots) || 0));
  const filesToConsider = Array.from(files || []).slice(0, MAX_FILES_PER_SELECTION);
  const uploadedAttachments = [];

  for (const file of filesToConsider) {
    if (uploadedAttachments.length >= slotLimit) {
      break;
    }

    if (Number(file?.size || 0) > MAX_ATTACHMENT_FILE_BYTES) {
      onOversized(file);
      continue;
    }

    try {
      const uploadResponse = await uploadFile(file);
      const attachment = uploadResponse?.file;

      if (!attachment || typeof attachment !== 'object') {
        throw new Error('Upload did not return an attachment.');
      }

      // Keep the server object intact so uploadId and future provenance fields
      // are carried into the message payload without client-side reconstruction.
      uploadedAttachments.push(attachment);
      onUploaded(attachment, uploadResponse, file);
    } catch (error) {
      onRejected(error, file);
    }
  }

  return uploadedAttachments;
}
