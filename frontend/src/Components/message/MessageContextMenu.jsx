import React from 'react';

function MessageContextMenu({ contextMenuMessage, handleCopyMessage, handleDeleteMessage, messageActionKey, messageContextMenu }) {
  if (!messageContextMenu || !contextMenuMessage) {
    return null;
  }

  return (
    <div
      className="message-context-menu"
      style={{
        left: `${messageContextMenu.x}px`,
        top: `${messageContextMenu.y}px`,
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <button type="button" onClick={() => handleCopyMessage(contextMenuMessage)}>
        <i className="bi bi-copy" />
        <span>Copy message</span>
      </button>

      <button
        type="button"
        className="danger"
        onClick={() => handleDeleteMessage(contextMenuMessage)}
        disabled={!messageContextMenu.canDelete || messageActionKey === `delete-${contextMenuMessage.id}`}
        title={messageContextMenu.canDelete ? 'Delete this message' : 'Only your own messages can be deleted'}
      >
        <i className="bi bi-trash3" />
        <span>{messageActionKey === `delete-${contextMenuMessage.id}` ? 'Deleting...' : 'Delete message'}</span>
      </button>
    </div>
  );
}

export default MessageContextMenu;
