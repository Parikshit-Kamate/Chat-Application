import React from 'react';
import AttachmentItem from './attachments/AttachmentItem';

export default function MessageAttachments({ message, attachmentAccess }) {
  return (
    <div className="attachment-list">
      {message.attachments.map((attachment, index) => (
        <AttachmentItem key={`${message.id}-file-${index}`}
          attachment={attachment} access={attachmentAccess} />
      ))}
    </div>
  );
}
