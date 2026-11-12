function createChatQueries({
  Chat,
  realtime,
  FriendRequest,
  serializeFriendRequest,
  serializeUserValue,
  Message,
  serializeChat
}) {
  const buildPairKey = require('./build-pair-key');
  const findDirectChat = require('./find-direct-chat')({ buildPairKey, Chat });
  const createOrReturnDirectChat = require('./create-or-return-direct-chat')({
    findDirectChat,
    buildPairKey,
    Chat,
    realtime
  });
  const hasAcceptedFriendship = require('./has-accepted-friendship')({ FriendRequest, buildPairKey });
  const fetchFriendOverview = require('./fetch-friend-overview')({
    FriendRequest,
    Chat,
    serializeFriendRequest,
    serializeUserValue
  });
  const isChatMember = require('./is-chat-member');
  const computeUnreadCount = require('./compute-unread-count')({ Message });
  const fetchChatByIdForUser = require('./fetch-chat-by-id-for-user')({
    Chat,
    isChatMember,
    computeUnreadCount,
    serializeChat
  });
  const fetchChatsForUser = require('./fetch-chats-for-user')({ Chat, Message, serializeChat });
  const syncChatLastMessage = require('./sync-chat-last-message')({ Message, Chat });
  return {
    buildPairKey,
    findDirectChat,
    createOrReturnDirectChat,
    hasAcceptedFriendship,
    fetchFriendOverview,
    isChatMember,
    computeUnreadCount,
    fetchChatByIdForUser,
    fetchChatsForUser,
    syncChatLastMessage
  };
}

module.exports = createChatQueries;
