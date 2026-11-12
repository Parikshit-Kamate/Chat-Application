import { useEffect } from 'react';
import io from 'socket.io-client';
import { SOCKET_URL } from '../constants';
import { createSocketHandlers } from './createSocketHandlers';

export function useSocketConnection(context) {
  const {
    currentUser, token, socketRef, clearUnreadCountForChat, loadChats,
    loadFriendsOverview, markChatAsSeen, pushToast, session,
  } = context;

  useEffect(() => {
    if (!currentUser || !token || !session.isCurrent()) {
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      withCredentials: true,
    });
    socketRef.current = socket;
    const handlers = createSocketHandlers(context, socket);
    const disconnect = () => socket.disconnect();
    session.signal.addEventListener('abort', disconnect, { once: true });

    for (const [event, handler] of Object.entries(handlers)) {
      socket.on(event, handler);
    }

    return () => {
      session.signal.removeEventListener('abort', disconnect);
      for (const [event, handler] of Object.entries(handlers)) {
        socket.off(event, handler);
      }
      socket.disconnect();
      socketRef.current = null;
    };
  }, [clearUnreadCountForChat, currentUser, loadChats, loadFriendsOverview, markChatAsSeen,
    pushToast, session, socketRef, token]);
}
