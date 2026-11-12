export function createTypingHandler(context) {
  const {
    setTypingUsers, activeChatIdRef, currentUserRef,
  } = context;

  const handleTypingUpdate = (payload) => {
    if (!payload || payload.chatId !== activeChatIdRef.current) {
      return;
    }

    if (payload.userId === currentUserRef.current?.id) {
      return;
    }

    setTypingUsers((prevTyping) => {
      const exists = prevTyping.some((user) => user.userId === payload.userId);

      if (payload.isTyping && !exists) {
        return [...prevTyping, { userId: payload.userId, username: payload.username }];
      }

      if (!payload.isTyping && exists) {
        return prevTyping.filter((user) => user.userId !== payload.userId);
      }

      return prevTyping;
    });
  };

  return handleTypingUpdate;
}
