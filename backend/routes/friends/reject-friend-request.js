const { normalizeObjectId } = require('./dependencies');

function createRejectFriendRequest({ FriendRequest, emitUserEvent, serializeFriendRequest }) {
  return async function rejectFriendRequest(req, res) {
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
        return res.status(403).json({ error: 'Only the recipient can reject this request.' });
      }
      if (requestDocument.status !== 'pending') {
        return res.status(409).json({ error: 'Friend request is no longer pending.' });
      }
      requestDocument.status = 'rejected';
      requestDocument.actedAt = new Date();
      await requestDocument.save();
      const requesterId = requestDocument.requester.toString();
      const hydratedRequest = await FriendRequest.findById(requestDocument._id)
        .populate('requester', 'username firstName lastName')
        .populate('recipient', 'username firstName lastName');
      emitUserEvent([userId, requesterId], 'friends:refresh');
      return res.json({ request: serializeFriendRequest(hydratedRequest, userId) });
    } catch (error) {
      console.error('Friend request reject error:', error);
      return res.status(500).json({ error: 'Unable to reject friend request.' });
    }
  };
}

module.exports = createRejectFriendRequest;
