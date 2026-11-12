import React from 'react';
import { getDisplayUsername, getUserPresenceLabel } from '../messageUtils';

export default function FriendSearch({
  friendSearch, setFriendSearch, isSearchingUsers, filteredFriendSearchResults,
  friendActionKey, handleSendFriendRequest,
}) {

  return (
    <div className="sidebar-section">
      <div className="section-heading">
        <h3>Add Friend</h3>
      </div>
    
      <div className="input-with-icon">
        <i className="bi bi-person-plus" />
        <input
          type="text"
          placeholder="Search usernames"
          value={friendSearch}
          onChange={(event) => setFriendSearch(event.target.value)}
        />
      </div>
    
      <div className="friend-panel-list">
        {friendSearch.trim().length > 0 && friendSearch.trim().length < 2 && (
          <div className="section-helper">Type at least 2 characters to search.</div>
        )}
    
        {isSearchingUsers && <div className="section-helper">Searching users...</div>}
    
        {!isSearchingUsers && friendSearch.trim().length >= 2 && filteredFriendSearchResults.length === 0 && (
          <div className="section-helper">No eligible users found.</div>
        )}
    
        {filteredFriendSearchResults.map((user) => (
          <div key={user.id} className="friend-row static">
            <div className="friend-row-main">
              <strong>{getDisplayUsername(user)}</strong>
              <small>{getUserPresenceLabel(user)}</small>
            </div>
            <button
              type="button"
              className="friend-row-button"
              onClick={() => handleSendFriendRequest(user.id)}
              disabled={friendActionKey === `send-${user.id}`}
            >
              {friendActionKey === `send-${user.id}` ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
