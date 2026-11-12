import { createAttachmentReferences } from '../attachmentUploads';
import { createClientMessageId } from './messagePaging';

export function createSendMessageActions(context) {
  const {
    messageText, setMessageText, replyTarget, setReplyTarget, setShowEmojiPicker,
    pendingAttachments, setPendingAttachments, socketRef, activeChatIdRef,
    pendingClientMessageIdRef, attachmentUploadActiveRef, pushToast, stopTyping, session, endSession,
  } = context;

  const handleSendMessage = () => {
    if (!session.isCurrent()) return;
    const socket = socketRef.current;
    const chatId = activeChatIdRef.current;

    if (!socket || !chatId) {
      return;
    }

    if (attachmentUploadActiveRef.current) {
      pushToast('Wait for the selected attachments to finish uploading.', 'warning');
      return;
    }

    const trimmedText = messageText.trim();
    if (!trimmedText && pendingAttachments.length === 0) {
      return;
    }

    const payload = {
      chatId,
      clientMessageId: pendingClientMessageIdRef.current || createClientMessageId(),
      text: trimmedText,
      replyToId: replyTarget?.id || null,
      attachments: createAttachmentReferences(pendingAttachments),
    };
    pendingClientMessageIdRef.current = payload.clientMessageId;

    socket.emit('message:send', payload, (response) => {
      if (!session.isCurrent()) return;
      if (response?.error) {
        if (response.code === 'AUTH_EXPIRED') {
          endSession({ expired: true });
          return;
        }
        if (response.code === 'CLIENT_MESSAGE_ID_CONFLICT') {
          pendingClientMessageIdRef.current = '';
        }
        pushToast(response.error, 'danger');
        return;
      }

      setMessageText('');
      setPendingAttachments([]);
      setReplyTarget(null);
      setShowEmojiPicker(false);
      pendingClientMessageIdRef.current = '';
      stopTyping();
    });
  };

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return {
    handleSendMessage, handleComposerKeyDown,
  };
}
