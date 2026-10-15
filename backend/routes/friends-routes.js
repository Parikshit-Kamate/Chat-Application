const express = require('express');
const { normalizeObjectId } = require('../lib/object-id');
const { createFixedWindowRateLimiter } = require('../lib/rate-limit');

function createFriendsRouter({ authHelpers, chatService, models, realtime }) {
  const router = express.Router();
  const { FriendRequest, User } = models;
  const { authRequired } = authHelpers;
  const {
    buildPairKey,
    createOrReturnDirectChat,
    fetchChatByIdForUser,
    fetchFriendOverview,
    findDirectChat,
    serializeFriendRequest,
  } = chatService;
  const { emitUserEvent } = realtime;
  const friendOverviewRateLimit = createFixedWindowRateLimiter({
    windowMs: 60 * 1000,
    maxAttempts: 60,
    message: 'Too many friend list requests. Please try again later.',
    getKey: (req) => `friends-read:${req.auth?.sub || 'unknown'}`,
  });
  const friendMutationRateLimit = createFixedWindowRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxAttempts: 30,
    message: 'Too many friend request changes. Please try again later.',
    getKey: (req) => `friends-write:${req.auth?.sub || 'unknown'}`,
  });

  router.get('/', authRequired, friendOverviewRateLimit, async (req, res) => {
    try {
      const overview = await fetchFriendOverview(req.auth.sub);
      return res.json(overview);
    } catch (error) {
      console.error('Friends fetch error:', error);
      return res.status(500).json({ error: 'Unable to fetch friends.' });
    }
  });

  router.post('/requests', authRequired, friendMutationRateLimit, async (req, res) => {
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
          actedAt: null,
        });
      }

      const hydratedRequest = await FriendRequest.findById(requestDocument._id)
        .populate('requester', 'username firstName lastName')
        .populate('recipient', 'username firstName lastName');

      emitUserEvent([requesterId, recipientUserId], 'friends:refresh');

      return res.status(existingRequest ? 200 : 201).json({
        request: serializeFriendRequest(hydratedRequest, requesterId),
      });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({ error: 'Friend request already exists for this user pair.' });
      }

      console.error('Friend request create error:', error);
      return res.status(500).json({ error: 'Unable to send friend request.' });
    }
  });

  router.post('/requests/:requestId/accept', authRequired, friendMutationRateLimit, async (req, res) => {
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

      return res.json({
        request: serializeFriendRequest(hydratedRequest, userId),
        chat: hydratedChat,
      });
    } catch (error) {
      console.error('Friend request accept error:', error);
      return res.status(500).json({ error: 'Unable to accept friend request.' });
    }
  });

  router.post('/requests/:requestId/reject', authRequired, friendMutationRateLimit, async (req, res) => {
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

      return res.json({
        request: serializeFriendRequest(hydratedRequest, userId),
      });
    } catch (error) {
      console.error('Friend request reject error:', error);
      return res.status(500).json({ error: 'Unable to reject friend request.' });
    }
  });

  return router;
}

module.exports = {
  createFriendsRouter,
};
