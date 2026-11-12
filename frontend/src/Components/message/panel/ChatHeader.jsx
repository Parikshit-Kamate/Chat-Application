import React from 'react';
import UserAvatar from '../UserAvatar';
import { getChatName, getOtherMember } from '../messageUtils';

export default function ChatHeader({
  activeChat, currentUser, activeChatSubline, typingText, setActiveChatId,
  isSearchOpen, setIsSearchOpen, searchInputRef, messageSearch = '', setMessageSearch, handleCloseSearch,
}) {

  return (
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
  );
}
