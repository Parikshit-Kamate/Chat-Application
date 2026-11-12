import React from 'react';
import { getDisplayUsername } from '../messageUtils';

export default function GroupBuilder({
  groupBuilderOpen, setGroupBuilderOpen, groupForm, setGroupForm, friends,
  toggleGroupMember, handleCreateGroupChat,
}) {

  return (
    <div className="sidebar-section">
      <div className="section-heading">
        <h3>Group Chat</h3>
      </div>
    
      <button type="button" className="group-toggle" onClick={() => setGroupBuilderOpen((isOpen) => !isOpen)}>
        {groupBuilderOpen ? 'Close Group Builder' : 'New Group Chat'}
      </button>
    
      {groupBuilderOpen && (
        <div className="group-builder">
          <input
            type="text"
            placeholder="Group name"
            value={groupForm.name}
            onChange={(event) =>
              setGroupForm((prevForm) => ({
                ...prevForm,
                name: event.target.value,
              }))
            }
          />
    
          <div className="group-user-list">
            {friends.map((friend) => (
              <label key={friend.id}>
                <input
                  type="checkbox"
                  checked={groupForm.memberIds.includes(friend.id)}
                  onChange={() => toggleGroupMember(friend.id)}
                />
                <span>{getDisplayUsername(friend)}</span>
              </label>
            ))}
          </div>
    
          {friends.length === 0 && <div className="section-helper">Add friends before creating a group.</div>}
    
          <button type="button" onClick={handleCreateGroupChat}>
            Create Group
          </button>
        </div>
      )}
    </div>
  );
}
