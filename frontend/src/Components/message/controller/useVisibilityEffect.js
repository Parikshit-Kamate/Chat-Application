import { useEffect } from 'react';

export function useVisibilityEffect(context) {
  const {
    socketRef, activeChatIdRef, markChatAsSeen,
  } = context;

  useEffect(() => {
    const handleVisibility = () => {
      if (!socketRef.current || !activeChatIdRef.current || document.visibilityState !== 'visible') {
        return;
      }

      markChatAsSeen(activeChatIdRef.current);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [markChatAsSeen]);
}
