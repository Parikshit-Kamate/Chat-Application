import { API_URL } from '../../constants';

const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const FILE_TYPES = new Set([...IMAGE_TYPES, 'application/pdf', 'text/plain', 'application/octet-stream']);

export async function requestAttachment(attachment, access, signal) {
  const uploadId = String(attachment?.uploadId || '');
  const endpoint = `/api/uploads/${uploadId}/content`;
  if (!/^[a-f0-9]{24}$/i.test(uploadId) || attachment.downloadUrl !== endpoint) {
    throw new Error('Attachment unavailable.');
  }
  if (!access?.token || !access.isCurrent() || access.signal?.aborted) {
    throw new DOMException('Session ended.', 'AbortError');
  }
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${access.token}` },
    signal,
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'error',
    referrerPolicy: 'no-referrer',
  });
  if (response.status === 401 && access.isCurrent()) access.expire?.();
  if (!response.ok) throw new Error('Attachment unavailable.');
  const mediaType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!FILE_TYPES.has(mediaType) ||
      (attachment.resourceType === 'image' && !IMAGE_TYPES.has(mediaType)) ||
      Number(response.headers.get('content-length')) > MAX_BYTES) {
    throw new Error('Attachment unavailable.');
  }
  const blob = await response.blob();
  if (!access.isCurrent() || access.signal?.aborted || signal.aborted) {
    throw new DOMException('Session ended.', 'AbortError');
  }
  if (!blob.size || blob.size > MAX_BYTES) throw new Error('Attachment unavailable.');
  return new Blob([blob], { type: mediaType });
}
