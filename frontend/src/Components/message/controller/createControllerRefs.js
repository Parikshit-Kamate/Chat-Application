export function createControllerRefs({ activeChatId, currentUser, messageSearch, pendingAttachments }) {
  return {
    socketRef: { current: null },
    activeChatIdRef: { current: activeChatId },
    currentUserRef: { current: currentUser },
    messageSearchRef: { current: messageSearch },
    messageScrollIntentRef: { current: 'none' },
    latestMessagesRequestRef: { current: 0 },
    typingTimeoutRef: { current: null },
    isTypingRef: { current: false },
    messageScrollerRef: { current: null },
    pendingClientMessageIdRef: { current: '' },
    attachmentUploadActiveRef: { current: false },
    pendingAttachmentCountRef: { current: pendingAttachments.length },
  };
}
