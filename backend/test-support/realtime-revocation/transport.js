function createIoAndSocket({ userId, username = 'sender' }) {
  const socketHandlers = {};
  const emittedEvents = [];
  const joinedRooms = new Set();
  const leftRooms = [];
  const socket = {
    id: `socket-${userId}`,
    connected: true,
    data: {
      activeChatId: null,
      authExpiresAtMs: Date.now() + 60_000,
      userId,
      username,
    },
    disconnect() {
      this.connected = false;
    },
    emit(eventName, payload) {
      emittedEvents.push({ eventName, payload, room: this.id });
    },
    join(roomName) {
      joinedRooms.add(roomName);
    },
    leave(roomName) {
      leftRooms.push(roomName);
      joinedRooms.delete(roomName);
    },
    on(eventName, handler) {
      socketHandlers[eventName] = handler;
    },
    to(roomName) {
      return {
        emit(eventName, payload) {
          emittedEvents.push({ eventName, payload, room: roomName });
        },
      };
    },
  };
  const io = {
    sockets: {
      sockets: new Map([[socket.id, socket]]),
    },
    on(eventName, handler) {
      if (eventName === 'connection') {
        this.connectionHandler = handler;
      }
    },
    to(roomName) {
      return {
        emit(eventName, payload) {
          emittedEvents.push({ eventName, payload, room: roomName });
        },
      };
    },
    use(handler) {
      this.middleware = handler;
    },
  };

  return {
    emittedEvents,
    io,
    joinedRooms,
    leftRooms,
    socket,
    socketHandlers,
  };
}

module.exports = { createIoAndSocket };
