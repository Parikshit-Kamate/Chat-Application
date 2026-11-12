import React from 'react';
import UserAvatar from './UserAvatar';
import { getDisplayUsername } from './messageUtils';
import ChatListRow from './sidebar/ChatListRow';

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

        {filteredChats.map((chat) => (
          <ChatListRow key={chat.id} chat={chat} currentUser={currentUser}
            activeChatId={activeChatId} setActiveChatId={setActiveChatId} />
        ))}
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
