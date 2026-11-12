import React from 'react';
import UserAvatar from '../UserAvatar';
import { formatChatListTime, getChatName, getChatPreview, getOtherMember, getVisibleUnreadCount } from '../messageUtils';

export default function ChatListRow({ chat, currentUser, activeChatId, setActiveChatId }) {
  const chatName = getChatName(chat, currentUser.id);
  const otherMember = getOtherMember(chat, currentUser.id);
  const resolvedUnreadCount = getVisibleUnreadCount(
    chat,
    currentUser.id,
    activeChatId,
    typeof document === 'undefined' || document.visibilityState === 'visible'
  );

  return (
    <button
      key={chat.id}
      type="button"
      className={`chat-row ${chat.id === activeChatId ? 'active' : ''}`}
      onClick={() => setActiveChatId(chat.id)}
    >
      <UserAvatar user={otherMember} name={chatName} className="chat-row-avatar" showPresence={chat.type === 'direct'} />

      <div className="chat-row-copy">
        <div className="chat-row-top">
          <div className="chat-row-title">
            <span>{chatName}</span>
            {chat.type === 'group' ? <i className="bi bi-people-fill" /> : null}
          </div>

          {chat.lastMessage?.createdAt ? (
            <time>
              <i className="bi bi-clock-history" />
              {formatChatListTime(chat.lastMessage.createdAt)}
            </time>
          ) : null}
        </div>

        {chat.id === activeChatId && chat.type === 'direct' && otherMember?.isOnline ? (
          <div className="chat-row-live-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : (
          <p className="chat-row-preview">{getChatPreview(chat, currentUser.id)}</p>
        )}
      </div>

      {resolvedUnreadCount > 0 && <span className="unread-pill">{resolvedUnreadCount}</span>}
    </button>
  );
}
