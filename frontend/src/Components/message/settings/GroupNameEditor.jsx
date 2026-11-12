import React from 'react';


export default function GroupNameEditor({
  activeChat, groupDetailsName, setGroupDetailsName, isCurrentUserGroupAdmin,
  handleRenameGroupChat, groupActionKey,
}) {

  return (
    <div className="group-name-editor">
      <input
        type="text"
        value={groupDetailsName}
        onChange={(event) => setGroupDetailsName(event.target.value)}
        disabled={!isCurrentUserGroupAdmin}
        aria-label="Group name"
      />
      {isCurrentUserGroupAdmin && (
        <button
          type="button"
          onClick={() => handleRenameGroupChat(activeChat.id, groupDetailsName)}
          disabled={groupActionKey === `rename-${activeChat.id}`}
        >
          {groupActionKey === `rename-${activeChat.id}` ? 'Saving...' : 'Save'}
        </button>
      )}
    </div>
  );
}
