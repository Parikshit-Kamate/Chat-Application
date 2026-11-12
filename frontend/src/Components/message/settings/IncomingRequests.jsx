import React from 'react';
import { getDisplayUsername, getUserPresenceLabel } from '../messageUtils';

export default function IncomingRequests({
  incomingRequests, isLoadingFriends, friendActionKey,
  handleAcceptFriendRequest, handleRejectFriendRequest,
}) {

  return (
    <div className="sidebar-section">
      <div className="section-heading">
        <h3>Incoming Requests</h3>
        <span>{incomingRequests.length}</span>
      </div>
    
      <div className="friend-panel-list">
        {isLoadingFriends && <div className="section-helper">Loading requests...</div>}
        {!isLoadingFriends && incomingRequests.length === 0 && <div className="section-helper">No incoming requests.</div>}
    
        {incomingRequests.map((request) => (
          <div key={request.id} className="friend-row static">
            <div className="friend-row-main">
              <strong>{getDisplayUsername(request.user)}</strong>
              <small>{getUserPresenceLabel(request.user)}</small>
            </div>
            <div className="friend-row-actions">
              <button
                type="button"
                className="friend-row-button accept"
                onClick={() => handleAcceptFriendRequest(request.id)}
                disabled={friendActionKey === `accept-${request.id}`}
              >
                {friendActionKey === `accept-${request.id}` ? 'Accepting...' : 'Accept'}
              </button>
              <button
                type="button"
                className="friend-row-button ghost"
                onClick={() => handleRejectFriendRequest(request.id)}
                disabled={friendActionKey === `reject-${request.id}`}
              >
                {friendActionKey === `reject-${request.id}` ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
