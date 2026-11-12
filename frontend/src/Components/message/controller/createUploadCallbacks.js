import { fileToDataUrl } from '../messageUtils';

export function createUploadCallbacks(context) {
  const {
    api, authHeaders, session, pendingAttachmentCountRef, setPendingAttachments, pushToast,
  } = context;
  return {
    uploadFile: async (file) => {
      const dataUrl = await fileToDataUrl(file);
      const response = await api.post('/uploads', {
        fileName: file.name, dataUrl, contentType: file.type, size: file.size,
      }, { headers: authHeaders });
      return response.data;
    },
    onUploaded: (attachment, response) => {
      if (!session.isCurrent()) return;
      pendingAttachmentCountRef.current += 1;
      setPendingAttachments((previous) => [...previous, attachment]);
      if (response?.fallback) {
        pushToast('Cloudinary not configured, file attached as temporary data URL.', 'warning');
      }
    },
    onRejected: (error, file) => {
      if (!session.isCurrent()) return;
      const message = error.response?.data?.error || error.message || 'File upload failed.';
      pushToast(`${file?.name || 'Attachment'}: ${message}`, 'danger');
    },
    onOversized: (file) => {
      if (session.isCurrent()) {
        pushToast(`${file?.name || 'Attachment'} is too large (max 10MB).`, 'warning');
      }
    },
  };
}
