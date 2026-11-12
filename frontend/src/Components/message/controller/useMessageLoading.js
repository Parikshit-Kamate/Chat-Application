import { useCallback } from 'react';
import { MESSAGE_PAGE_SIZE, EMPTY_MESSAGE_PAGE_INFO, getNextMessagePageInfo } from './messagePaging';

export function useMessageLoading(context) {
  const {
    api, token, setMessages, setMessagePageInfo, setIsLoadingMessages, setIsLoadingOlderMessages,
    activeChatIdRef, messageScrollIntentRef, latestMessagesRequestRef, authHeaders, pushToast,
    markChatAsSeen,
  } = context;

  const loadMessages = useCallback(
    async (chatId, query = '') => {
      if (!chatId || !token) {
        return;
      }

      const requestId = latestMessagesRequestRef.current + 1;
      const normalizedQuery = String(query || '').trim();
      latestMessagesRequestRef.current = requestId;

      try {
        setIsLoadingMessages(true);
        setIsLoadingOlderMessages(false);
        setMessagePageInfo(EMPTY_MESSAGE_PAGE_INFO);
        messageScrollIntentRef.current = 'bottom';

        const response = await api.get(`/chats/${chatId}/messages`, {
          headers: authHeaders,
          params: {
            limit: MESSAGE_PAGE_SIZE,
            ...(normalizedQuery ? { query: normalizedQuery } : {}),
          },
        });

        if (latestMessagesRequestRef.current !== requestId || activeChatIdRef.current !== chatId) {
          return;
        }

        setMessages(response.data.messages || []);
        setMessagePageInfo(getNextMessagePageInfo(response.data.pageInfo));

        if (!normalizedQuery) {
          await markChatAsSeen(chatId, { awaitRequest: true });
        }
      } catch (error) {
        if (latestMessagesRequestRef.current === requestId) {
          pushToast(error.response?.data?.error || 'Unable to load messages.', 'danger');
        }
      } finally {
        if (latestMessagesRequestRef.current === requestId) {
          setIsLoadingMessages(false);
        }
      }
    },
    [api, authHeaders, markChatAsSeen, pushToast, token]
  );

  return {
    loadMessages,
  };
}
