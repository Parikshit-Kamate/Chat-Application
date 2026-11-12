const { normalizeObjectId } = require('./dependencies');

function createSendFriendRequest({
  User,
  findDirectChat,
  buildPairKey,
  FriendRequest,
  emitUserEvent,
  serializeFriendRequest
}) {
  return async function sendFriendRequest(req, res) {
    try {
      const requesterId = req.auth.sub;
      const recipientUserId = normalizeObjectId(req.body.recipientUserId);
      if (!recipientUserId) {
        return res.status(400).json({ error: 'Invalid recipient user.' });
      }
      if (recipientUserId === requesterId) {
        return res.status(400).json({ error: 'Cannot send a friend request to yourself.' });
      }
      const recipientUser = await User.findById(recipientUserId).select('_id');
      if (!recipientUser) {
        return res.status(404).json({ error: 'Recipient user not found.' });
      }
      const existingDirectChat = await findDirectChat(requesterId, recipientUserId);
      if (existingDirectChat) {
        return res.status(409).json({ error: 'You are already connected and can message this user.' });
      }
      const pairKey = buildPairKey(requesterId, recipientUserId);
      const existingRequest = await FriendRequest.findOne({ pairKey });
      if (existingRequest?.status === 'accepted') {
        return res.status(409).json({ error: 'You are already friends with this user.' });
      }
      if (existingRequest?.status === 'pending') {
        if (existingRequest.requester.toString() === requesterId) {
          return res.status(409).json({ error: 'Friend request already sent.' });
        }
        return res.status(409).json({ error: 'This user already sent you a friend request. Accept it first.' });
      }
      let requestDocument = existingRequest;
      if (requestDocument) {
        requestDocument.requester = requesterId;
        requestDocument.recipient = recipientUserId;
        requestDocument.status = 'pending';
        requestDocument.actedAt = null;
        await requestDocument.save();
      } else {
        requestDocument = await FriendRequest.create({
          requester: requesterId,
          recipient: recipientUserId,
          pairKey,
          status: 'pending',
          actedAt: null
        });
      }
      const hydratedRequest = await FriendRequest.findById(requestDocument._id)
        .populate('requester', 'username firstName lastName')
        .populate('recipient', 'username firstName lastName');
      emitUserEvent([requesterId, recipientUserId], 'friends:refresh');
      return res.status(existingRequest ? 200 : 201).json({
        request: serializeFriendRequest(hydratedRequest, requesterId)
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ error: 'Friend request already exists for this user pair.' });
      }
      console.error('Friend request create error:', error);
      return res.status(500).json({ error: 'Unable to send friend request.' });
    }
  };
}

module.exports = createSendFriendRequest;
