import { useCallback } from 'react';
import { MESSAGE_PAGE_SIZE, getNextMessagePageInfo } from './messagePaging';

export function useOlderMessages(context) {
  const {
    api, token, setMessages, messagePageInfo, setMessagePageInfo, isLoadingMessages,
    isLoadingOlderMessages, setIsLoadingOlderMessages, activeChatIdRef, messageSearchRef,
    messageScrollIntentRef, authHeaders, pushToast,
  } = context;

  const loadOlderMessages = useCallback(async () => {
    const chatId = activeChatIdRef.current;
    const query = messageSearchRef.current.trim();
    const cursor = messagePageInfo.nextCursor;

    if (!chatId || !token || !messagePageInfo.hasMore || !cursor || isLoadingMessages || isLoadingOlderMessages) {
      return;
    }

    try {
      setIsLoadingOlderMessages(true);
      messageScrollIntentRef.current = 'preserve';

      const response = await api.get(`/chats/${chatId}/messages`, {
        headers: authHeaders,
        params: {
          limit: MESSAGE_PAGE_SIZE,
          cursor,
          ...(query ? { query } : {}),
        },
      });

      if (activeChatIdRef.current !== chatId || messageSearchRef.current.trim() !== query) {
        return;
      }

      const olderMessages = response.data.messages || [];
      setMessages((prevMessages) => {
        const existingIds = new Set(prevMessages.map((message) => message.id));
        const uniqueOlderMessages = olderMessages.filter((message) => message?.id && !existingIds.has(message.id));

        if (uniqueOlderMessages.length === 0) {
          return prevMessages;
        }

        return [...uniqueOlderMessages, ...prevMessages];
      });
      setMessagePageInfo(getNextMessagePageInfo(response.data.pageInfo));
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to load older messages.', 'danger');
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }, [
    api,
    authHeaders,
    isLoadingMessages,
    isLoadingOlderMessages,
    messagePageInfo.hasMore,
    messagePageInfo.nextCursor,
    pushToast,
    token,
  ]);

  return {
    loadOlderMessages,
  };
}
