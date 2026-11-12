function createSerialization({ realtime }) {
  const escapeRegExp = require('./escape-reg-exp');
  const normalizeAttachment = require('./normalize-attachment');
  const idList = require('./id-list');
  const serializeUser = require('./serialize-user')({ realtime });
  const serializeUserValue = require('./serialize-user-value')({ serializeUser });
  const getUserDisplayName = require('./get-user-display-name');
  const serializeReply = require('./serialize-reply')({ serializeUser });
  const serializeMessage = require('./serialize-message')({
    serializeUser,
    normalizeAttachment,
    serializeReply,
    idList
  });
  const serializeChat = require('./serialize-chat')({
    serializeUser,
    getUserDisplayName,
    idList,
    serializeMessage
  });
  const serializeFriendRequest = require('./serialize-friend-request')({ serializeUserValue });
  return {
    escapeRegExp,
    normalizeAttachment,
    idList,
    serializeUser,
    serializeUserValue,
    getUserDisplayName,
    serializeReply,
    serializeMessage,
    serializeChat,
    serializeFriendRequest
  };
}

module.exports = createSerialization;
