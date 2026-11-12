import React from 'react';
import UserAvatar from '../UserAvatar';
import MessageAttachments from './MessageAttachments';
import { formatMessageMetaTime, getDisplayUsername, getMessageState } from '../messageUtils';

export default function MessageBubble({
  message, currentUser, activeChat, highlightMessageId, handleOpenMessageContextMenu,
  setHighlightMessageId, setReplyTarget, attachmentAccess,
}) {
  const isMine = message.sender?.id === currentUser.id;
  const messageState = getMessageState(message, activeChat, currentUser.id);

  return (
    <div
      id={`msg-${message.id}`}
      key={message.id}
      className={`message-row ${isMine ? 'mine' : 'theirs'} ${highlightMessageId === message.id ? 'highlighted' : ''}`}
    >
      {!isMine && (
        <UserAvatar user={message.sender} className="message-avatar" showPresence />
      )}

      <div className="message-stack">
        <div className="message-bubble" onContextMenu={(event) => handleOpenMessageContextMenu(event, message, isMine)}>
          {activeChat.type === 'group' && !isMine ? (
            <span className="message-sender-inline">{getDisplayUsername(message.sender)}</span>
          ) : null}

          {message.replyTo && (
            <button
              type="button"
              className="reply-context"
              onClick={() => setHighlightMessageId(message.replyTo.id)}
            >
              <strong>{getDisplayUsername(message.replyTo.sender, 'Reply')}</strong>
              <span>{message.replyTo.text || 'Attachment'}</span>
            </button>
          )}

          {message.text ? <p>{message.text}</p> : null}

          {Array.isArray(message.attachments) && message.attachments.length > 0 && (
            <MessageAttachments message={message} attachmentAccess={attachmentAccess} />
          )}

          <div className="message-footer">
            <div className="message-actions">
              <button type="button" onClick={() => setReplyTarget(message)} aria-label="Reply to message">
                <i className="bi bi-reply-fill" />
              </button>
            </div>

            <div className="message-meta">
              <time>{formatMessageMetaTime(message.createdAt)}</time>
              {isMine && (
                <span className="delivery-state" title={messageState.text}>
                  <i className={`bi ${messageState.icon}`} />
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {isMine && <UserAvatar user={currentUser} className="message-avatar" showPresence />}
    </div>
  );
}
