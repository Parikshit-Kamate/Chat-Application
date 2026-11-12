import React from 'react';
import { getDisplayUsername } from '../messageUtils';

export default function ComposerPreviews({ replyTarget, setReplyTarget, pendingAttachments, setPendingAttachments }) {

  return (
    <>
      {replyTarget && (
        <div className="reply-preview">
          <div>
            <strong>Replying to {getDisplayUsername(replyTarget.sender)}</strong>
            <span>{replyTarget.text || 'Attachment'}</span>
          </div>
          <button type="button" onClick={() => setReplyTarget(null)}>
            <i className="bi bi-x" />
          </button>
        </div>
      )}
      {pendingAttachments.length > 0 && (
        <div className="pending-attachments">
          {pendingAttachments.map((attachment, index) => (
            <div key={`pending-${index}`} className="pending-chip">
              <span>{attachment.fileName || `Attachment ${index + 1}`}</span>
              <button
                type="button"
                onClick={() =>
                  setPendingAttachments((previous) =>
                    previous.filter((_, attachmentIndex) => attachmentIndex !== index)
                  )
                }
              >
                <i className="bi bi-x" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
