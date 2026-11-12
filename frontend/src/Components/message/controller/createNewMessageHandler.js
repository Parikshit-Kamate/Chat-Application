export function createNewMessageHandler(context, socket) {
  const {
    setChats, setMessages, activeChatIdRef, currentUserRef, messageScrollIntentRef, loadChats,
    markChatAsSeen, handleIncomingNotification,
  } = context;

  const handleMessageNew = (incomingMessage) => {
    if (!incomingMessage?.id || !incomingMessage.chatId) {
      return;
    }

    const chatIsActive = incomingMessage.chatId === activeChatIdRef.current;
    const isOwnMessage = incomingMessage.sender?.id === currentUserRef.current?.id;

    setChats((prevChats) => {
      const existingChat = prevChats.find((chat) => chat.id === incomingMessage.chatId);

      if (!existingChat) {
        loadChats();
        return prevChats;
      }

      return prevChats
        .map((chat) => {
          if (chat.id !== incomingMessage.chatId) {
            return chat;
          }

          const unreadDelta = chatIsActive || isOwnMessage ? 0 : 1;
          return {
            ...chat,
            unreadCount: (chat.unreadCount || 0) + unreadDelta,
            lastMessage: incomingMessage,
            updatedAt: incomingMessage.createdAt || chat.updatedAt,
          };
        })
        .sort((leftChat, rightChat) => new Date(rightChat.updatedAt) - new Date(leftChat.updatedAt));
    });

    if (chatIsActive) {
      messageScrollIntentRef.current = 'bottom';
      setMessages((prevMessages) => {
        if (prevMessages.some((message) => message.id === incomingMessage.id)) {
          return prevMessages;
        }

        return [...prevMessages, incomingMessage];
      });

      if (!isOwnMessage) {
        if (document.visibilityState === 'visible') {
          markChatAsSeen(incomingMessage.chatId);
        } else {
          socket.emit('message:delivered', {
            chatId: incomingMessage.chatId,
            messageId: incomingMessage.id,
          });
        }
      }
    } else if (!isOwnMessage) {
      handleIncomingNotification({ chatId: incomingMessage.chatId, message: incomingMessage });
    }
  };

  return handleMessageNew;
}
