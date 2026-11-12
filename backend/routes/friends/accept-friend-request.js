const { normalizeObjectId } = require('./dependencies');

function createAcceptFriendRequest({
  FriendRequest,
  createOrReturnDirectChat,
  fetchChatByIdForUser,
  emitUserEvent,
  serializeFriendRequest
}) {
  return async function acceptFriendRequest(req, res) {
    try {
      const userId = req.auth.sub;
      const requestId = normalizeObjectId(req.params.requestId);
      if (!requestId) {
        return res.status(400).json({ error: 'Invalid request ID.' });
      }
      const requestDocument = await FriendRequest.findById(requestId);
      if (!requestDocument) {
        return res.status(404).json({ error: 'Friend request not found.' });
      }
      if (requestDocument.recipient.toString() !== userId) {
        return res.status(403).json({ error: 'Only the recipient can accept this request.' });
      }
      if (requestDocument.status !== 'pending') {
        return res.status(409).json({ error: 'Friend request is no longer pending.' });
      }
      requestDocument.status = 'accepted';
      requestDocument.actedAt = new Date();
      await requestDocument.save();
      const requesterId = requestDocument.requester.toString();
      const chat = await createOrReturnDirectChat(userId, requesterId);
      const hydratedChat = await fetchChatByIdForUser(chat._id, userId);
      const hydratedRequest = await FriendRequest.findById(requestDocument._id)
        .populate('requester', 'username firstName lastName isOnline lastSeen')
        .populate('recipient', 'username firstName lastName isOnline lastSeen');
      emitUserEvent([userId, requesterId], 'friends:refresh');
      emitUserEvent([userId, requesterId], 'chat:list:refresh');
      return res.json({ request: serializeFriendRequest(hydratedRequest, userId), chat: hydratedChat });
    } catch (error) {
      console.error('Friend request accept error:', error);
      return res.status(500).json({ error: 'Unable to accept friend request.' });
    }
  };
}

module.exports = createAcceptFriendRequest;
