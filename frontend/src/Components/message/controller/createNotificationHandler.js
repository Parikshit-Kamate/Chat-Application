import { getDisplayUsername } from '../messageUtils';

export function createNotificationHandler(context) {
  const {
    currentUserRef, pushToast,
  } = context;

  const triggerBrowserNotification = (payload) => {
    if (!payload?.message || payload.message.sender?.id === currentUserRef.current?.id) {
      return;
    }

    if (!('Notification' in window)) {
      return;
    }

    if (Notification.permission === 'granted') {
      new Notification('New Confabulate message', {
        body: 'Open the app to view your message.',
      });
    }
  };

  const handleIncomingNotification = (payload) => {
    if (!payload?.message || payload.message.sender?.id === currentUserRef.current?.id) {
      return;
    }

    const sender = getDisplayUsername(payload.message.sender, 'Someone');
    const messagePreview = payload.message.text || 'Sent an attachment';
    pushToast(`${sender}: ${messagePreview}`, 'info');
    triggerBrowserNotification(payload);
  };

  return handleIncomingNotification;
}
