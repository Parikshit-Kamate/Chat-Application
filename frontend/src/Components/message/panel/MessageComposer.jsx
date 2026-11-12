import React from 'react';
import UserAvatar from '../UserAvatar';
import { MAX_PENDING_ATTACHMENTS } from '../attachmentUploads';
import ComposerPreviews from './ComposerPreviews';
import EmojiPicker from './EmojiPicker';

export default function MessageComposer(props) {
  const {
    currentUser, pendingAttachments, uploading, setShowEmojiPicker, handleFileSelection,
    typingText, messageText, handleMessageInput, handleComposerKeyDown, handleSendMessage,
    showEmojiPicker, setMessageText,
  } = props;
  const attachmentsFull = pendingAttachments.length >= MAX_PENDING_ATTACHMENTS;
  return (
    <footer className="chat-composer">
      <ComposerPreviews {...props} />

      <div className="composer-row">
        <button type="button" className="icon-btn" onClick={() => setShowEmojiPicker((isOpen) => !isOpen)}>
          <i className="bi bi-emoji-smile" />
        </button>

        <label
          className="icon-btn upload-btn"
          aria-disabled={uploading || attachmentsFull}
          title={attachmentsFull ? `Maximum ${MAX_PENDING_ATTACHMENTS} attachments` : 'Attach files'}
        >
          <i className="bi bi-plus-lg" />
          <input
            type="file"
            multiple
            onChange={handleFileSelection}
            disabled={uploading || attachmentsFull}
            aria-label="Attach files"
          />
        </label>

        <div className="composer-input-shell">
          {typingText && <div className="typing-indicator">{typingText}</div>}

          <textarea
            value={messageText}
            onChange={handleMessageInput}
            onKeyDown={handleComposerKeyDown}
            placeholder="Type a message..."
            rows={1}
          />
        </div>

        <button
          type="button"
          className={`send-btn ${uploading ? 'sending' : ''}`}
          onClick={handleSendMessage}
          disabled={uploading}
          aria-label={uploading ? 'Sending message' : 'Send message'}
        >
          {uploading ? <span className="send-btn-spinner" aria-hidden="true" /> : <i className="bi bi-send-fill" />}
        </button>

        <UserAvatar user={currentUser} className="composer-avatar" showPresence />
      </div>

      {showEmojiPicker && <EmojiPicker setMessageText={setMessageText} />}
    </footer>
  );
}
