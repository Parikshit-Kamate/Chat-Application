function createSendTransport(token) {
  const roomEvents = [];
  const clientEvents = [];
  const socketHandlers = {};
  const io = {
    sockets: {
      sockets: new Map(),
    },
    use(handler) {
      this.middleware = handler;
    },
    on(eventName, handler) {
      if (eventName === 'connection') {
        this.connectionHandler = handler;
      }
    },
    emit(eventName, payload) {
      roomEvents.push({ room: null, eventName, payload });
    },
    to(room) {
      return {
        emit(eventName, payload) {
          roomEvents.push({ room, eventName, payload });
        },
      };
    },
  };

  const socket = {
    id: 'socket-1',
    connected: true,
    data: {},
    handshake: {
      auth: { token },
      headers: {},
    },
    join(room) {
      this.rooms = this.rooms || [];
      this.rooms.push(room);
    },
    emit(eventName, payload) {
      clientEvents.push({ eventName, payload });
    },
    on(eventName, handler) {
      socketHandlers[eventName] = handler;
    },
    to(room) {
      return {
        emit(eventName, payload) {
          roomEvents.push({ room, eventName, payload });
        },
      };
    },
  };
  return { io, socket, roomEvents, clientEvents, socketHandlers };
}

module.exports = { createSendTransport };
