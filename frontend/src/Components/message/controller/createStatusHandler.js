export function createStatusHandler(context) {
  const {
    currentUser, setChats, setMessages, clearUnreadCountForChat,
  } = context;

  const handleMessageStatus = (status) => {
    const seenByCurrentUser = Boolean(currentUser?.id && (status.seenBy || []).includes(currentUser.id));

    if (seenByCurrentUser) {
      clearUnreadCountForChat(status.chatId);
    }

    setMessages((prevMessages) =>
      prevMessages.map((message) =>
        message.id === status.messageId
          ? {
              ...message,
              deliveredTo: status.deliveredTo || [],
              seenBy: status.seenBy || [],
            }
          : message
      )
    );

    setChats((prevChats) =>
      prevChats.map((chat) => {
        if (chat.id !== status.chatId) {
          return chat;
        }

        if (!chat.lastMessage || chat.lastMessage.id !== status.messageId) {
          return chat;
        }

        return {
          ...chat,
          lastMessage: {
            ...chat.lastMessage,
            deliveredTo: status.deliveredTo || [],
            seenBy: status.seenBy || [],
          },
        };
      })
    );
  };

  return handleMessageStatus;
}
