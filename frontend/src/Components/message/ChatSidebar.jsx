import React from 'react';
import UserAvatar from './UserAvatar';
import {
  formatChatListTime,
  getChatName,
  getChatPreview,
  getDisplayUsername,
  getOtherMember,
  getVisibleUnreadCount,
} from './messageUtils';

function ChatSidebar({
  activeChat,
  activeChatId,
  currentUser,
  filteredChats,
  isChatListInitializing,
  isLoadingChats,
  pendingFriendRequestCount,
  setActiveChatId,
  setIsSettingsOpen,
  setSidebarSearch,
  sidebarSearch,
}) {
  return (
    <aside className={`chat-sidebar ${activeChat ? 'mobile-hidden' : ''}`}>
      <div className="sidebar-topbar">
        <div className="sidebar-top-profile">
          <UserAvatar user={currentUser} className="sidebar-user-avatar" showPresence />
          <div className="sidebar-title-copy">
            <span>{getDisplayUsername(currentUser)}</span>
          </div>
        </div>

        <div className="sidebar-top-actions">
          <button type="button" className="logout-btn settings-btn" onClick={() => setIsSettingsOpen(true)} aria-label="Open settings" title="Settings">
            <i className="bi bi-gear-fill" />
            <span>Open settings</span>
            {pendingFriendRequestCount > 0 && <strong className="settings-badge">{pendingFriendRequestCount}</strong>}
          </button>
        </div>
      </div>

      <div className="sidebar-search-strip">
        <label className="search-field" htmlFor="chat-search">
          <i className="bi bi-search" />
          <input
            id="chat-search"
            type="text"
            placeholder="Search or start a new chat"
            value={sidebarSearch}
            onChange={(event) => setSidebarSearch(event.target.value)}
          />
        </label>
      </div>

      <div className="chat-list">
        {isLoadingChats && !isChatListInitializing && <div className="sidebar-helper">Loading chats...</div>}
        {!isLoadingChats && filteredChats.length === 0 && (
          <div className="sidebar-helper">No chats found. Open Settings to start a conversation.</div>
        )}

        {filteredChats.map((chat) => {
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
        })}
      </div>

      <footer className="sidebar-footer">
        <div className="sidebar-user-card">
          <UserAvatar user={currentUser} className="sidebar-user-avatar" showPresence />

          <div className="sidebar-user-copy">
            <strong>{getDisplayUsername(currentUser)}</strong>
            <span>Signed in</span>
          </div>
        </div>
      </footer>
    </aside>
  );
}

export default ChatSidebar;
