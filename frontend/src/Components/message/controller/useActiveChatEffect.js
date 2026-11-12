import { useEffect } from 'react';
import { EMPTY_MESSAGE_PAGE_INFO } from './messagePaging';

export function useActiveChatEffect(context) {
  const {
    token, activeChatId, setMessages, setMessagePageInfo, messageSearch, setTypingUsers,
    setIsLoadingOlderMessages, socketRef, stopTyping, markChatAsSeen, loadMessages,
  } = context;

  useEffect(() => {
    if (!activeChatId || !token) {
      setMessages([]);
      setMessagePageInfo(EMPTY_MESSAGE_PAGE_INFO);
      setIsLoadingOlderMessages(false);
      setTypingUsers([]);
      return;
    }

    setMessages([]);
    setMessagePageInfo(EMPTY_MESSAGE_PAGE_INFO);
    setIsLoadingOlderMessages(false);
    socketRef.current?.emit('chat:open', { chatId: activeChatId });
    markChatAsSeen(activeChatId);

    return () => {
      socketRef.current?.emit('chat:close', { chatId: activeChatId });
      stopTyping();
      setTypingUsers([]);
    };
  }, [activeChatId, markChatAsSeen, stopTyping, token]);

  useEffect(() => {
    if (!activeChatId || !token) {
      return;
    }

    const timer = window.setTimeout(() => {
      loadMessages(activeChatId, messageSearch.trim());
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeChatId, loadMessages, messageSearch, token]);
}
