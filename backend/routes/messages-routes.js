const express = require('express');
const { createFixedWindowRateLimiter } = require('../lib/rate-limit');
const { normalizeObjectId } = require('../lib/object-id');

const MAX_SEARCHABLE_CHATS = 500;
const MAX_CONCURRENT_ATTACHMENT_CLEANUPS = 2;
const MAX_QUEUED_ATTACHMENT_CLEANUPS = 100;

function createMessagesRouter({ authHelpers, chatService, io, models, realtime }) {
  const router = express.Router();
  const { Chat, Message } = models;
  const { authRequired } = authHelpers;
  const {
    deleteMessageAttachments,
    escapeRegExp,
    isChatMember,
    prepareMessageAttachmentsForDeletion,
    restoreMessageAttachments,
    serializeMessage,
    syncChatLastMessage,
  } = chatService;
  const { emitUserEvent } = realtime;
  const runChatOperationExclusive =
    realtime.runChatOperationExclusive || (async (_chatId, operation) => operation());
  const attachmentCleanupQueue = [];
  const scheduledAttachmentCleanups = new Set();
  let activeAttachmentCleanups = 0;

  const drainAttachmentCleanupQueue = () => {
    while (
      activeAttachmentCleanups < MAX_CONCURRENT_ATTACHMENT_CLEANUPS &&
      attachmentCleanupQueue.length > 0
    ) {
      const cleanup = attachmentCleanupQueue.shift();
      activeAttachmentCleanups += 1;

      Promise.resolve()
        .then(() =>
          deleteMessageAttachments({
            messageId: cleanup.messageId,
            ownerId: cleanup.ownerId,
          })
        )
        .catch((error) => {
          console.error('Message attachment cleanup scheduling error:', error);
        })
        .finally(() => {
          activeAttachmentCleanups -= 1;
          scheduledAttachmentCleanups.delete(cleanup.key);
          drainAttachmentCleanupQueue();
        });
    }
  };

  const scheduleAttachmentCleanup = ({ messageId, ownerId }) => {
    const key = `${ownerId}:${messageId}`;
    if (scheduledAttachmentCleanups.has(key)) {
      return true;
    }

    if (attachmentCleanupQueue.length >= MAX_QUEUED_ATTACHMENT_CLEANUPS) {
      console.warn('Attachment cleanup queue is full; durable cleanup will retry it later.');
      return false;
    }

    scheduledAttachmentCleanups.add(key);
    attachmentCleanupQueue.push({ key, messageId, ownerId });
    drainAttachmentCleanupQueue();
    return true;
  };

  const messageSearchRateLimit = createFixedWindowRateLimiter({
    windowMs: 60 * 1000,
    maxAttempts: 30,
    message: 'Too many message searches. Please try again later.',
    getKey: (req) => `message-search:${req.auth?.sub || 'unknown'}`,
  });

  router.delete('/messages/:messageId', authRequired, async (req, res) => {
    try {
      const userId = req.auth.sub;
      const messageId = normalizeObjectId(req.params.messageId);

      if (!messageId) {
        return res.status(400).json({ error: 'Invalid message ID.' });
      }

      const initialMessage = await Message.findById(messageId).select('_id chat');
      if (!initialMessage) {
        return res.status(404).json({ error: 'Message not found.' });
      }

      const deleteResult = await runChatOperationExclusive(initialMessage.chat.toString(), async () => {
        const message = await Message.findById(messageId).select('_id chat sender');
        if (!message) {
          return { status: 404, error: 'Message not found.' };
        }

        const chat = await Chat.findById(message.chat).select('_id createdAt members.user');
        if (!chat || !isChatMember(chat, userId)) {
          return { status: 404, error: 'Chat not found.' };
        }

        if (message.sender.toString() !== userId) {
          return { status: 403, error: 'You can only delete your own messages.' };
        }

        await prepareMessageAttachmentsForDeletion({ messageId, ownerId: userId });

        try {
          const deletion = await Message.deleteOne({ _id: messageId, sender: userId });
          if (deletion?.deletedCount === 0) {
            await restoreMessageAttachments({ messageId, ownerId: userId });
            return { status: 404, error: 'Message not found.' };
          }
        } catch (error) {
          let messageStillExists;
          try {
            messageStillExists = await Message.exists({ _id: messageId, sender: userId });
          } catch (verificationError) {
            console.error('Message deletion verification error:', verificationError);
            throw error;
          }

          if (messageStillExists) {
            await restoreMessageAttachments({ messageId, ownerId: userId });
            throw error;
          }
        }

        try {
          await syncChatLastMessage(chat);
        } catch (error) {
          console.error('Message metadata reconciliation error:', error);
        }

        return {
          chatId: chat._id.toString(),
          memberIds: chat.members.map((member) => member.user.toString()),
        };
      });

      if (deleteResult.error) {
        return res.status(deleteResult.status).json({ error: deleteResult.error });
      }

      const { chatId, memberIds } = deleteResult;

      scheduleAttachmentCleanup({ messageId, ownerId: userId });

      io.to(`chat:${chatId}`).emit('message:deleted', {
        chatId,
        messageId,
      });

      emitUserEvent(memberIds, 'chat:list:refresh');

      return res.json({ ok: true, messageId, chatId });
    } catch (error) {
      console.error('Message delete error:', error);
      return res.status(500).json({ error: 'Unable to delete message.' });
    }
  });

  router.get('/search/messages', authRequired, messageSearchRateLimit, async (req, res) => {
    try {
      const userId = req.auth.sub;
      const query = String(req.query.query || '').trim();

      if (query.length < 2) {
        return res.json({ results: [] });
      }

      if (query.length > 200) {
        return res.status(400).json({ error: 'Search query is too long.' });
      }

      const chats = await Chat.find({ 'members.user': userId }).select('_id').limit(MAX_SEARCHABLE_CHATS);
      const chatIds = chats.map((chat) => chat._id);

      const matchingMessages = await Message.find({
        chat: { $in: chatIds },
        text: { $regex: escapeRegExp(query), $options: 'i' },
      })
        .sort({ createdAt: -1 })
        .limit(40)
        .populate('sender', 'username firstName lastName isOnline lastSeen')
        .populate({
          path: 'replyTo',
          populate: [
            {
              path: 'sender',
              select: 'username firstName lastName isOnline lastSeen',
            },
          ],
        });

      return res.json({
        results: matchingMessages.map(serializeMessage),
      });
    } catch (error) {
      console.error('Search error:', error);
      return res.status(500).json({ error: 'Unable to search messages.' });
    }
  });

  return router;
}

module.exports = {
  createMessagesRouter,
};
