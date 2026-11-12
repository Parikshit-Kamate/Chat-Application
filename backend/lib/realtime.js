function createRealtimeHelpers(io) {
  const onlineSocketsByUser = new Map();
  const chatOperationQueues = new Map();
  const getRevokedChatIdsForSocket = require('./realtime/get-revoked-chat-ids-for-socket');
  const joinSocketToChat = require('./realtime/join-socket-to-chat')({ getRevokedChatIdsForSocket });
  const runChatOperationExclusive = require('./realtime/run-chat-operation-exclusive')({ chatOperationQueues });
  const getLiveSocketIdsForUser = require('./realtime/get-live-socket-ids-for-user')({
    onlineSocketsByUser,
    io
  });
  const emitUserEvent = require('./realtime/emit-user-event')({ io });
  const joinUserSocketsToChat = require('./realtime/join-user-sockets-to-chat')({
    getLiveSocketIdsForUser,
    io,
    getRevokedChatIdsForSocket
  });
  const leaveUserSocketsFromChat = require('./realtime/leave-user-sockets-from-chat')({
    getLiveSocketIdsForUser,
    io,
    getRevokedChatIdsForSocket
  });
  const addUserSocket = require('./realtime/add-user-socket')({ onlineSocketsByUser });
  const removeUserSocket = require('./realtime/remove-user-socket')({ onlineSocketsByUser });
  const isUserOnline = require('./realtime/is-user-online')({ getLiveSocketIdsForUser });
  const isUserActiveInChat = require('./realtime/is-user-active-in-chat')({ getLiveSocketIdsForUser, io });
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
    runChatOperationExclusive
  };
}

module.exports = { createRealtimeHelpers };
