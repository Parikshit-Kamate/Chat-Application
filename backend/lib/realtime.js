function createRealtimeHelpers(io) {
  const onlineSocketsByUser = new Map();
  const chatOperationQueues = new Map();

  function getRevokedChatIdsForSocket(socket) {
    if (!socket.data) {
      socket.data = {};
    }

    if (!(socket.data.revokedChatIds instanceof Set)) {
      socket.data.revokedChatIds = new Set();
    }

    return socket.data.revokedChatIds;
  }

  function joinSocketToChat(socket, chatId) {
    const normalizedChatId = String(chatId || '');
    if (!normalizedChatId || !socket) {
      return false;
    }

    if (getRevokedChatIdsForSocket(socket).has(normalizedChatId)) {
      return false;
    }

    socket.join(`chat:${normalizedChatId}`);
    return true;
  }

  function runChatOperationExclusive(chatId, operation) {
    const normalizedChatId = String(chatId || '');
    if (!normalizedChatId || typeof operation !== 'function') {
      return Promise.reject(new TypeError('A chat ID and operation are required.'));
    }

    const previousOperation = chatOperationQueues.get(normalizedChatId) || Promise.resolve();
    const currentOperation = previousOperation.catch(() => {}).then(operation);
    chatOperationQueues.set(normalizedChatId, currentOperation);

    return currentOperation.finally(() => {
      if (chatOperationQueues.get(normalizedChatId) === currentOperation) {
        chatOperationQueues.delete(normalizedChatId);
      }
    });
  }

  function getLiveSocketIdsForUser(userId) {
    const normalizedUserId = String(userId || '');
    if (!normalizedUserId) {
      return [];
    }

    const socketIds = onlineSocketsByUser.get(normalizedUserId);
    if (!socketIds || socketIds.size === 0) {
      return [];
    }

    const liveSocketIds = [];

    socketIds.forEach((socketId) => {
      if (io.sockets.sockets.has(socketId)) {
        liveSocketIds.push(socketId);
      }
    });

    if (liveSocketIds.length === socketIds.size) {
      return liveSocketIds;
    }

    if (liveSocketIds.length === 0) {
      onlineSocketsByUser.delete(normalizedUserId);
      return [];
    }

    onlineSocketsByUser.set(normalizedUserId, new Set(liveSocketIds));
    return liveSocketIds;
  }

  function emitUserEvent(userIds, eventName, payload) {
    Array.from(new Set(userIds.map((userId) => String(userId)))).forEach((userId) => {
      io.to(`user:${userId}`).emit(eventName, payload);
    });
  }

  function joinUserSocketsToChat(userIds, chatId) {
    const roomName = `chat:${chatId}`;

    userIds.forEach((rawUserId) => {
      const userId = String(rawUserId);
      const socketIds = getLiveSocketIdsForUser(userId);

      if (socketIds.length === 0) {
        return;
      }

      socketIds.forEach((socketId) => {
        const connectedSocket = io.sockets.sockets.get(socketId);
        if (!connectedSocket) {
          return;
        }

        getRevokedChatIdsForSocket(connectedSocket).delete(String(chatId));
        connectedSocket.join(roomName);
      });
    });
  }

  async function leaveUserSocketsFromChat(userId, chatId) {
    const normalizedChatId = String(chatId || '');
    if (!normalizedChatId) {
      return;
    }

    const roomName = `chat:${normalizedChatId}`;
    const socketIds = getLiveSocketIdsForUser(userId);

    await Promise.all(socketIds.map(async (socketId) => {
      const connectedSocket = io.sockets.sockets.get(socketId);
      if (!connectedSocket) {
        return;
      }

      getRevokedChatIdsForSocket(connectedSocket).add(normalizedChatId);

      if (connectedSocket.data?.activeChatId === normalizedChatId) {
        connectedSocket.data.activeChatId = null;
      }

      try {
        await connectedSocket.leave(roomName);
      } catch (error) {
        console.error('Unable to remove socket from chat room:', error);
        connectedSocket.disconnect?.(true);
      }

    }));
  }

  function addUserSocket(userId, socketId) {
    const normalizedUserId = String(userId || '');
    const socketIds = onlineSocketsByUser.get(normalizedUserId) || new Set();
    socketIds.add(socketId);
    onlineSocketsByUser.set(normalizedUserId, socketIds);
  }

  function removeUserSocket(userId, socketId) {
    const normalizedUserId = String(userId || '');
    const socketIds = onlineSocketsByUser.get(normalizedUserId);
    if (!socketIds) {
      return;
    }

    socketIds.delete(socketId);
    if (socketIds.size === 0) {
      onlineSocketsByUser.delete(normalizedUserId);
    }
  }

  function isUserOnline(userId) {
    return getLiveSocketIdsForUser(userId).length > 0;
  }

  function isUserActiveInChat(userId, chatId) {
    const socketIds = getLiveSocketIdsForUser(userId);
    if (socketIds.length === 0) {
      return false;
    }

    for (const socketId of socketIds) {
      const connectedSocket = io.sockets.sockets.get(socketId);
      if (connectedSocket?.data?.activeChatId === chatId) {
        return true;
      }
    }

    return false;
  }

  return {
    addUserSocket,
    emitUserEvent,
    getLiveSocketIdsForUser,
    isUserActiveInChat,
    isUserOnline,
    joinSocketToChat,
    joinUserSocketsToChat,
    leaveUserSocketsFromChat,
    removeUserSocket,
    runChatOperationExclusive,
  };
}

module.exports = {
  createRealtimeHelpers,
};
