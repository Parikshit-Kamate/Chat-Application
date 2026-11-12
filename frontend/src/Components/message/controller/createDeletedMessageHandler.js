export function createDeletedMessageHandler(context) {
  const {
    setMessages, setHighlightMessageId, setReplyTarget, setMessageContextMenu,
  } = context;

  const handleMessageDeleted = (payload) => {
    if (!payload?.messageId || !payload.chatId) {
      return;
    }

    setMessages((prevMessages) =>
      prevMessages
        .filter((message) => message.id !== payload.messageId)
        .map((message) =>
          message.replyTo?.id === payload.messageId
            ? {
                ...message,
                replyTo: null,
              }
            : message
        )
    );

    setReplyTarget((prevReplyTarget) => (prevReplyTarget?.id === payload.messageId ? null : prevReplyTarget));
    setHighlightMessageId((prevHighlightMessageId) => (prevHighlightMessageId === payload.messageId ? '' : prevHighlightMessageId));

    setMessageContextMenu((prevMenu) => (prevMenu?.messageId === payload.messageId ? null : prevMenu));
  };

  return handleMessageDeleted;
}
