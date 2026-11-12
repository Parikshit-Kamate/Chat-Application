import React from 'react';
import { getDisplayUsername } from '../messageUtils';

export default function AddGroupMembers({
  activeChat, addableGroupFriends, selectedGroupMemberIds, toggleSelectedGroupMember,
  handleAddSelectedGroupMembers, groupActionKey,
}) {

  return (
    <div className="group-builder compact">
      <div className="section-heading small">
        <h3>Add Members</h3>
      </div>
    
      {addableGroupFriends.length === 0 && <div className="section-helper">No more friends available to add.</div>}
    
      {addableGroupFriends.length > 0 && (
        <>
          <div className="group-user-list">
            {addableGroupFriends.map((friend) => (
              <label key={friend.id}>
                <input
                  type="checkbox"
                  checked={selectedGroupMemberIds.includes(friend.id)}
                  onChange={() => toggleSelectedGroupMember(friend.id)}
                />
                <span>{getDisplayUsername(friend)}</span>
              </label>
            ))}
          </div>
    
          <button
            type="button"
            onClick={handleAddSelectedGroupMembers}
            disabled={selectedGroupMemberIds.length === 0 || groupActionKey === `add-${activeChat.id}`}
          >
            {groupActionKey === `add-${activeChat.id}` ? 'Adding...' : 'Add Selected'}
          </button>
        </>
      )}
    </div>
  );
}
