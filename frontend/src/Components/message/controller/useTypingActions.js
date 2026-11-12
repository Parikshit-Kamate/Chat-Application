import { useCallback, useEffect } from 'react';

export function useTypingActions(context) {
  const {
    setMessageText, socketRef, activeChatIdRef, typingTimeoutRef, isTypingRef, session,
  } = context;

  const stopTyping = useCallback(() => {
    const chatId = activeChatIdRef.current;
    const socket = socketRef.current;

    if (!chatId || !socket || !isTypingRef.current) {
      return;
    }

    socket.emit('typing:stop', { chatId });
    isTypingRef.current = false;
  }, [activeChatIdRef, socketRef, isTypingRef]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [typingTimeoutRef]);

  const handleStartTyping = () => {
    if (!session.isCurrent()) return;
    const socket = socketRef.current;
    const chatId = activeChatIdRef.current;

    if (!socket || !chatId) {
      return;
    }

    if (!isTypingRef.current) {
      socket.emit('typing:start', { chatId });
      isTypingRef.current = true;
    }

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      stopTyping();
    }, 1200);
  };

  const handleMessageInput = (event) => {
    setMessageText(event.target.value);
    handleStartTyping();
  };

  return {
    stopTyping, handleMessageInput,
  };
}
