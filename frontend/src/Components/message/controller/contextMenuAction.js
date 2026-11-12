

export function createContextMenuAction(context) {
  const {
    setMessageContextMenu,
  } = context;

  const handleOpenMessageContextMenu = (event, message, canDelete) => {
    event.preventDefault();

    const menuWidth = 172;
    const menuHeight = canDelete ? 108 : 60;
    const viewportWidth = window.innerWidth || 0;
    const viewportHeight = window.innerHeight || 0;
    const x = Math.max(12, Math.min(event.clientX, viewportWidth - menuWidth - 12));
    const y = Math.max(12, Math.min(event.clientY, viewportHeight - menuHeight - 12));

    setMessageContextMenu({
      messageId: message.id,
      x,
      y,
      canDelete,
    });
  };

  return {
    handleOpenMessageContextMenu,
  };
}
