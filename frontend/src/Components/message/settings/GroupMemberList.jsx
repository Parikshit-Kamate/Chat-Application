import React from 'react';
import { getDisplayUsername, getUserPresenceLabel } from '../messageUtils';

export default function GroupMemberList({ activeChat, currentUser, isCurrentUserGroupAdmin, handleRemoveGroupMember, groupActionKey }) {

  return (
    <div className="group-member-list">
      {(activeChat.members || []).map((member) => {
        const isMemberAdmin = (activeChat.admins || []).includes(member.id);
        const isMe = member.id === currentUser.id;
        const canRemoveMember = isCurrentUserGroupAdmin && !isMe;
    
        return (
          <div key={member.id} className="friend-row static group-member-row">
            <div className="friend-row-main">
              <strong>{getDisplayUsername(member)}</strong>
              <small>{getUserPresenceLabel(member)}</small>
            </div>
            <div className="friend-row-actions">
              {isMemberAdmin && <span className="friend-row-badge">Admin</span>}
              {isMe && <span className="friend-row-badge pending">You</span>}
              {canRemoveMember && (
                <button
                  type="button"
                  className="friend-row-button ghost danger"
                  onClick={() => handleRemoveGroupMember(activeChat.id, member.id)}
                  disabled={groupActionKey === `remove-${member.id}`}
                >
                  {groupActionKey === `remove-${member.id}` ? 'Removing...' : 'Remove'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
