import { useCallback } from 'react';
import { getVisibleUnreadCount } from '../messageUtils';

export function useChatLoading(context) {
  const {
    api, token, setChats, setActiveChatId, setHasLoadedInitialChats, setIsLoadingChats,
    activeChatIdRef, currentUserRef, authHeaders, pushToast,
  } = context;

  const loadChats = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setIsLoadingChats(true);
      const response = await api.get('/chats', {
        headers: authHeaders,
      });

      const nextChats = (response.data.chats || []).map((chat) => {
        const resolvedUnreadCount = getVisibleUnreadCount(
          chat,
          currentUserRef.current?.id,
          activeChatIdRef.current,
          typeof document === 'undefined' || document.visibilityState === 'visible'
        );

        if (resolvedUnreadCount === Number(chat.unreadCount || 0)) {
          return chat;
        }

        return {
          ...chat,
          unreadCount: resolvedUnreadCount,
        };
      });
      setChats(nextChats);

      setActiveChatId((prevChatId) => {
        if (prevChatId && nextChats.some((chat) => chat.id === prevChatId)) {
          return prevChatId;
        }

        return null;
      });
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to load chats.', 'danger');
    } finally {
      setIsLoadingChats(false);
      setHasLoadedInitialChats(true);
    }
  }, [api, authHeaders, pushToast, token]);

  return {
    loadChats,
  };
}
