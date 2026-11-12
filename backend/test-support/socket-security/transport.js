function createTransport(token) {
  const socketHandlers = {};
  const roomEvents = [];
  const directEvents = [];
  const disconnectCalls = [];
  const io = {
    sockets: { sockets: new Map() },
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
    id: 'security-socket-1',
    connected: true,
    data: {},
    handshake: { auth: { token }, headers: {} },
    join(room) {
      this.rooms = this.rooms || [];
      this.rooms.push(room);
    },
    emit(eventName, payload) {
      directEvents.push({ eventName, payload });
    },
    on(eventName, handler) {
      socketHandlers[eventName] = handler;
    },
    to: io.to,
    disconnect(force) {
      disconnectCalls.push(force);
      this.connected = false;
      if (socketHandlers.disconnect) {
        this.disconnectCleanup = Promise.resolve(socketHandlers.disconnect('server namespace disconnect'));
      }
    },
  };
  return { io, socket, socketHandlers, roomEvents, directEvents, disconnectCalls };
}

module.exports = { createTransport };
