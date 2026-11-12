import {
  MAX_FILES_PER_SELECTION,
  MAX_PENDING_ATTACHMENTS,
  uploadAttachmentBatch,
} from '../attachmentUploads';
import { createUploadCallbacks } from './createUploadCallbacks';

export function createAttachmentAction(context) {
  const {
    session, setUploading, attachmentUploadActiveRef, pendingAttachmentCountRef, pushToast,
  } = context;

  const handleFileSelection = async (event) => {
    if (!session.isCurrent()) return;
    const fileInput = event.currentTarget || event.target;
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;
    if (attachmentUploadActiveRef.current) {
      pushToast('Another attachment upload is already in progress.', 'warning');
      fileInput.value = '';
      return;
    }
    const availableSlots = Math.max(0, MAX_PENDING_ATTACHMENTS - pendingAttachmentCountRef.current);
    if (availableSlots === 0) {
      pushToast(`You can attach up to ${MAX_PENDING_ATTACHMENTS} files.`, 'warning');
      fileInput.value = '';
      return;
    }
    if (selectedFiles.length > MAX_FILES_PER_SELECTION) {
      pushToast(`Only the first ${MAX_FILES_PER_SELECTION} selected files will be considered.`, 'warning');
    }
    if (selectedFiles.length > availableSlots) {
      pushToast(`Only ${availableSlots} more attachment${availableSlots === 1 ? '' : 's'} can be added.`, 'warning');
    }
    try {
      attachmentUploadActiveRef.current = true;
      setUploading(true);
      await uploadAttachmentBatch({
        files: selectedFiles, availableSlots, ...createUploadCallbacks(context),
      });
    } finally {
      if (session.isCurrent()) {
        attachmentUploadActiveRef.current = false;
        setUploading(false);
        fileInput.value = '';
      }
    }
  };

  return { handleFileSelection };
}
