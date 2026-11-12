import { useCallback } from 'react';

export function useReadReceipts(context) {
  const {
    api, token, setChats, socketRef, authHeaders,
  } = context;

  const clearUnreadCountForChat = useCallback((chatId) => {
    if (!chatId) {
      return;
    }

    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              unreadCount: 0,
            }
          : chat
      )
    );
  }, [setChats]);

  const markChatAsSeen = useCallback(
    async (chatId, { awaitRequest = false } = {}) => {
      if (!chatId || !token) {
        return;
      }

      clearUnreadCountForChat(chatId);
      socketRef.current?.emit('messages:mark_seen', { chatId });

      const request = api
        .post(
          `/chats/${chatId}/read`,
          {},
          {
            headers: authHeaders,
          }
        )
        .catch(() => {});

      if (awaitRequest) {
        await request;
      }
    },
    [api, authHeaders, clearUnreadCountForChat, token]
  );

  return {
    clearUnreadCountForChat, markChatAsSeen,
  };
}
