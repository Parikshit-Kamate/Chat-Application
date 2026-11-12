import { createStatusHandler } from './createStatusHandler';
import { createPresenceHandler } from './createPresenceHandler';
import { createTypingHandler } from './createTypingHandler';
import { createNotificationHandler } from './createNotificationHandler';
import { createNewMessageHandler } from './createNewMessageHandler';
import { createDeletedMessageHandler } from './createDeletedMessageHandler';

export function createSocketHandlers(context, socket) {
  const { loadChats, loadFriendsOverview, pushToast, session } = context;
  const handleIncomingNotification = createNotificationHandler(context);

  const handlers = {
    connect: () => {
      loadChats();
      loadFriendsOverview();
    },
    connect_error: (error) => pushToast(error.message || 'Socket connection failed.', 'danger'),
    'chat:list:refresh': loadChats,
    'friends:refresh': loadFriendsOverview,
    'presence:update': createPresenceHandler(context),
    'typing:update': createTypingHandler(context),
    'message:status': createStatusHandler(context),
    'message:deleted': createDeletedMessageHandler(context),
    'notification:new_message': handleIncomingNotification,
    'message:new': createNewMessageHandler({ ...context, handleIncomingNotification }, socket),
  };
  return Object.fromEntries(Object.entries(handlers).map(([event, handler]) => [
    event, (...args) => session.isCurrent() ? handler(...args) : undefined,
  ]));
}
