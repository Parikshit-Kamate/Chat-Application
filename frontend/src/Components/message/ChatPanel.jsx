import React, { useEffect, useRef, useState } from 'react';
import { MAX_PENDING_ATTACHMENTS } from './attachmentUploads';
import { EMOJI_SET } from './constants';
import UserAvatar from './UserAvatar';
import {
  formatMessageMetaTime,
  getChatName,
  getDisplayUsername,
  getMessageState,
  getOtherMember,
  isImageAttachment,
} from './messageUtils';

function ChatPanel({
  activeChat,
  activeChatSubline,
  currentUser,
  handleComposerKeyDown,
  handleFileSelection,
  handleLoadOlderMessages = () => {},
  handleMessageInput,
  handleOpenMessageContextMenu,
  handleSendMessage,
  hasMoreMessages = false,
  highlightMessageId,
  isChatListInitializing,
  isLoadingMessages,
  isLoadingOlderMessages = false,
  messageScrollerRef,
  messageSearch = '',
  messageText,
  messages,
  pendingAttachments,
  replyTarget,
  setActiveChatId,
  setHighlightMessageId,
  setMessageSearch,
  setMessageText,
  setPendingAttachments,
  setReplyTarget,
  setShowEmojiPicker,
  showEmojiPicker,
  typingText,
  uploading,
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const messageListRef = useRef(null);
  const pendingScrollHeightRef = useRef(null);
  const searchInputRef = useRef(null);
  const isGroupChat = activeChat?.type === 'group';
  const trimmedMessageSearch = messageSearch.trim();
  const attachmentsFull = pendingAttachments.length >= MAX_PENDING_ATTACHMENTS;

  const requestOlderMessages = () => {
    if (!hasMoreMessages || isLoadingMessages || isLoadingOlderMessages || pendingScrollHeightRef.current !== null) {
      return;
    }

    pendingScrollHeightRef.current = messageListRef.current?.scrollHeight || 0;
    handleLoadOlderMessages();
  };

  const handleMessagesScroll = () => {
    const messageList = messageListRef.current;

    if (!messageList || messageList.scrollTop > 96) {
      return;
    }

    requestOlderMessages();
  };

  useEffect(() => {
    if (trimmedMessageSearch) {
      setIsSearchOpen(true);
    }
  }, [trimmedMessageSearch]);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (isLoadingOlderMessages || pendingScrollHeightRef.current === null) {
      return;
    }

    const messageList = messageListRef.current;
    if (messageList) {
      messageList.scrollTop += messageList.scrollHeight - pendingScrollHeightRef.current;
    }

    pendingScrollHeightRef.current = null;
  }, [isLoadingOlderMessages, messages.length]);

  useEffect(() => {
    pendingScrollHeightRef.current = null;
  }, [activeChat?.id, trimmedMessageSearch]);

  const handleCloseSearch = () => {
    setMessageSearch('');
    setIsSearchOpen(false);
  };

  return (
    <section className={`chat-panel ${activeChat ? 'mobile-visible' : ''} ${isGroupChat ? 'group-chat-panel' : ''}`}>
      {!activeChat && !isChatListInitializing && (
        <div className="empty-panel">
          <strong>Select a conversation</strong>
          <span>Your chats appear on the left. Friend requests, groups, and search tools are available in Settings.</span>
        </div>
      )}

      {activeChat && (
        <>
          <header className={`chat-header ${isSearchOpen ? 'search-open' : ''}`}>
            <button type="button" className="mobile-back" onClick={() => setActiveChatId(null)}>
              <i className="bi bi-arrow-left" />
            </button>

            <UserAvatar
              user={activeChat.type === 'direct' ? getOtherMember(activeChat, currentUser.id) : null}
              name={getChatName(activeChat, currentUser.id)}
              className="chat-header-avatar"
              showPresence={activeChat.type === 'direct'}
            />

            <div className="chat-header-copy">
              <h3>{getChatName(activeChat, currentUser.id)}</h3>
              <small>{typingText || activeChatSubline}</small>
            </div>

            {isSearchOpen && (
              <div className="chat-header-search" role="search">
                <i className="bi bi-search" />
                <input
                  id="active-chat-search"
                  ref={searchInputRef}
                  type="text"
                  aria-label="Search messages in this chat"
                  placeholder={`Search ${getChatName(activeChat, currentUser.id)}`}
                  value={messageSearch}
                  onChange={(event) => setMessageSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') {
                      handleCloseSearch();
                    }
                  }}
                />
                <button type="button" onClick={handleCloseSearch} aria-label="Close message search">
                  <i className="bi bi-x" />
                </button>
              </div>
            )}

            <div className="header-actions">
              {!isSearchOpen && (
                <button type="button" className="header-tool-btn" onClick={() => setIsSearchOpen(true)} aria-label="Search messages">
                  <i className="bi bi-search" />
                </button>
              )}
            </div>
          </header>

          <div className="chat-messages" ref={messageListRef} onScroll={handleMessagesScroll}>
            {hasMoreMessages && (
              <button
                type="button"
                className="load-older-messages"
                onClick={requestOlderMessages}
                disabled={isLoadingMessages || isLoadingOlderMessages}
              >
                {isLoadingOlderMessages ? 'Loading older messages...' : 'Load older messages'}
              </button>
            )}

            {isLoadingMessages && <div className="message-helper">Loading messages...</div>}

            {!isLoadingMessages && messages.length === 0 && (
              <div className="message-helper">
                {trimmedMessageSearch ? 'No messages match your search.' : 'No messages yet. Start the conversation.'}
              </div>
            )}

            {messages.map((message) => {
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
                        <div className="attachment-list">
                          {message.attachments.map((attachment, index) => (
                            <a
                              key={`${message.id}-file-${index}`}
                              href={attachment.secureUrl || attachment.url}
                              target="_blank"
                              rel="noreferrer"
                              className="attachment-item"
                            >
                              {isImageAttachment(attachment) ? (
                                <img
                                  src={attachment.secureUrl || attachment.url}
                                  alt={attachment.fileName || 'attachment'}
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span>
                                  <i className="bi bi-paperclip" />
                                  {attachment.fileName || 'Attachment'}
                                </span>
                              )}
                            </a>
                          ))}
                        </div>
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
            })}

            <div ref={messageScrollerRef} />
          </div>

          <footer className="chat-composer">
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
                        setPendingAttachments((prevAttachments) =>
                          prevAttachments.filter((_, attachmentIndex) => attachmentIndex !== index)
                        )
                      }
                    >
                      <i className="bi bi-x" />
                    </button>
                  </div>
                ))}
              </div>
            )}

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

            {showEmojiPicker && (
              <div className="emoji-picker">
                {EMOJI_SET.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => setMessageText((previousText) => `${previousText}${emoji}`)}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </footer>
        </>
      )}
    </section>
  );
}

export default ChatPanel;
