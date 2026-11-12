import { useEffect } from 'react';

export function useContextMenuEffect(context) {
  const {
    messageContextMenu, setMessageContextMenu,
  } = context;

  useEffect(() => {
    if (!messageContextMenu) {
      return undefined;
    }

    const handleCloseMenu = () => {
      setMessageContextMenu(null);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMessageContextMenu(null);
      }
    };

    window.addEventListener('click', handleCloseMenu);
    window.addEventListener('scroll', handleCloseMenu, true);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('click', handleCloseMenu);
      window.removeEventListener('scroll', handleCloseMenu, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [messageContextMenu]);
}
