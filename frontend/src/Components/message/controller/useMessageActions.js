import { useCallback } from 'react';
import { getCopyableMessageContent } from '../messageUtils';

export function useMessageActions(context) {
  const {
    api, setMessageContextMenu, setMessageActionKey, authHeaders, pushToast, session,
  } = context;

  const copyTextToClipboard = useCallback(async (text) => {
    if (!text) {
      throw new Error('Nothing to copy.');
    }

    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    document.execCommand('copy');
    document.body.removeChild(helper);
  }, []);

  const handleCopyMessage = useCallback(
    async (message) => {
      if (!session.isCurrent()) return;
      try {
        const value = getCopyableMessageContent(message);
        await copyTextToClipboard(value);
        pushToast('Message copied.', 'success');
      } catch (error) {
        pushToast(error.message || 'Unable to copy message.', 'danger');
      } finally {
        setMessageContextMenu(null);
      }
    },
    [copyTextToClipboard, pushToast, session]
  );

  const handleDeleteMessage = useCallback(
    async (message) => {
      if (!message?.id) {
        return;
      }

      try {
        setMessageActionKey(`delete-${message.id}`);
        await api.delete(`/messages/${message.id}`, {
          headers: authHeaders,
        });

        pushToast('Message deleted.', 'success');
      } catch (error) {
        pushToast(error.response?.data?.error || 'Unable to delete message.', 'danger');
      } finally {
        setMessageActionKey('');
        setMessageContextMenu(null);
      }
    },
    [api, authHeaders, pushToast]
  );

  return {
    handleCopyMessage, handleDeleteMessage,
  };
}
