import React from 'react';
import { useAttachmentContent } from './useAttachmentContent';
import { useAttachmentVisibility } from './useAttachmentVisibility';

export default function AttachmentItem({ attachment, access }) {
  const { elementRef, visible } = useAttachmentVisibility();
  const isImage = attachment.resourceType === 'image';
  const { url, loading, error, load } = useAttachmentContent(attachment, access, isImage && visible);
  const fileName = attachment.fileName || 'Attachment';
  const download = async () => {
    const blobUrl = await load();
    if (!blobUrl || !access?.isCurrent()) return;
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.rel = 'noreferrer';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div ref={elementRef} className="protected-attachment">
      {isImage && url ? (
        <a href={url} download={fileName} className="attachment-item" rel="noreferrer">
          <img src={url} alt={fileName} referrerPolicy="no-referrer" />
        </a>
      ) : (
        <button type="button" className="attachment-item" onClick={download}
          disabled={loading || !access?.isCurrent()} aria-label={`Download ${fileName}`}>
          <span><i className="bi bi-paperclip" />{fileName}</span>
          {loading && <small role="status">Loading attachment...</small>}
          {error && <small role="alert">Attachment unavailable. Try again.</small>}
        </button>
      )}
    </div>
  );
}
