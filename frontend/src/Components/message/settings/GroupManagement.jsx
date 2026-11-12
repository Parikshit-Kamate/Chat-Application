import React from 'react';
import GroupNameEditor from './GroupNameEditor';
import GroupMemberList from './GroupMemberList';
import AddGroupMembers from './AddGroupMembers';

export default function GroupManagement(props) {
  const { activeChat, isCurrentUserGroupAdmin, handleLeaveActiveGroup, groupActionKey, currentUser } = props;
  return (
    <div className="sidebar-section group-management-section">
      <div className="section-heading">
        <h3>Current Group</h3>
        <span>{activeChat.members?.length || 0}</span>
      </div>
    
      <GroupNameEditor {...props} />
    
      <GroupMemberList {...props} />
    
      {isCurrentUserGroupAdmin && (
        <AddGroupMembers {...props} />
      )}
    
      <button
        type="button"
        className="settings-danger-btn"
        onClick={handleLeaveActiveGroup}
        disabled={groupActionKey === `remove-${currentUser.id}`}
      >
        <i className="bi bi-box-arrow-right" />
        <span>{groupActionKey === `remove-${currentUser.id}` ? 'Leaving...' : 'Leave Group'}</span>
      </button>
    </div>
  );
}
