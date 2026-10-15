const express = require('express');
const mongoose = require('mongoose');
const { createFixedWindowRateLimiter } = require('../lib/rate-limit');
const { normalizeObjectId } = require('../lib/object-id');

const MAX_GROUP_MEMBERS = 50;
const MAX_MESSAGE_QUERY_LENGTH = 200;
const MAX_CURSOR_LENGTH = 512;

function createChatsRouter({ authHelpers, chatService, models, realtime }) {
  const router = express.Router();
  const { Chat, Message, User } = models;
  const { authRequired } = authHelpers;
  const {
    createOrReturnDirectChat,
    emitStatusUpdates,
    escapeRegExp,
    fetchChatByIdForUser,
    fetchChatsForUser,
    findDirectChat,
    hasAcceptedFriendship,
    idList,
    isChatMember,
    markMessagesDelivered,
    markMessagesSeen,
    serializeMessage,
  } = chatService;
  const { emitUserEvent, joinUserSocketsToChat, leaveUserSocketsFromChat } = realtime;
  const runChatOperationExclusive =
    realtime.runChatOperationExclusive || (async (_chatId, operation) => operation());
  const DEFAULT_MESSAGE_PAGE_SIZE = 40;
  const MAX_MESSAGE_PAGE_SIZE = 80;
  const groupMutationRateLimit = createFixedWindowRateLimiter({
    windowMs: 15 * 60 * 1000,
    maxAttempts: 30,
    message: 'Too many group changes. Please try again later.',
    getKey: (req) => `group:${req.auth?.sub || 'unknown'}`,
  });
  const chatListRateLimit = createFixedWindowRateLimiter({
    windowMs: 60 * 1000,
    maxAttempts: 30,
    message: 'Too many chat list requests. Please try again later.',
    getKey: (req) => `chat-list:${req.auth?.sub || 'unknown'}`,
  });
  const messageHistoryRateLimit = createFixedWindowRateLimiter({
    windowMs: 60 * 1000,
    maxAttempts: 120,
    message: 'Too many message history requests. Please try again later.',
    getKey: (req) => `message-history:${req.auth?.sub || 'unknown'}`,
  });
  const inChatSearchRateLimit = createFixedWindowRateLimiter({
    windowMs: 60 * 1000,
    maxAttempts: 30,
    message: 'Too many message searches. Please try again later.',
    getKey: (req) => `chat-search:${req.auth?.sub || 'unknown'}`,
  });

  function limitInChatSearch(req, res, next) {
    if (String(req.query.query || '').trim()) {
      return inChatSearchRateLimit(req, res, next);
    }
    return next();
  }

  async function areAcceptedFriends(userId, targetUserIds) {
    const friendshipResults = await Promise.all(
      targetUserIds.map((targetUserId) => hasAcceptedFriendship(userId, targetUserId))
    );
    return friendshipResults.every(Boolean);
  }

  function getGroupMemberIds(chat) {
    return (chat.members || []).map((member) => member.user.toString());
  }

  function isGroupAdmin(chat, userId) {
    return idList(chat.admins || []).includes(userId);
  }

  function getMessagePageSize(value) {
    const requestedLimit = Number.parseInt(String(value || ''), 10);

    if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
      return DEFAULT_MESSAGE_PAGE_SIZE;
    }

    return Math.min(requestedLimit, MAX_MESSAGE_PAGE_SIZE);
  }

  function encodeMessageCursor(message) {
    if (!message?._id || !message?.createdAt) {
      return '';
    }

    return Buffer.from(
      JSON.stringify({
        id: message._id.toString(),
        createdAt: new Date(message.createdAt).toISOString(),
      })
    ).toString('base64url');
  }

  function decodeMessageCursor(rawCursor) {
    const cursor = String(rawCursor || '').trim();

    if (!cursor) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      const createdAt = new Date(payload.createdAt);
      const id = normalizeObjectId(payload.id);

      if (Number.isNaN(createdAt.getTime()) || !id) {
        return null;
      }

      return {
        createdAt,
        id: new mongoose.Types.ObjectId(id),
      };
    } catch (_error) {
      return null;
    }
  }

  router.get('/chats', authRequired, chatListRateLimit, async (req, res) => {
    try {
      const chats = await fetchChatsForUser(req.auth.sub);
      return res.json({ chats });
    } catch (error) {
      console.error('Chats fetch error:', error);
      return res.status(500).json({ error: 'Unable to fetch chats.' });
    }
  });

  router.post('/chats/direct', authRequired, async (req, res) => {
    try {
      const userId = req.auth.sub;
      const targetUserId = normalizeObjectId(req.body.targetUserId);

      if (!targetUserId) {
        return res.status(400).json({ error: 'Invalid target user.' });
      }

      if (targetUserId === userId) {
        return res.status(400).json({ error: 'Cannot create a direct chat with yourself.' });
      }

      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Target user not found.' });
      }

      let chat = await findDirectChat(userId, targetUserId);

      if (!chat) {
        const isFriend = await hasAcceptedFriendship(userId, targetUserId);

        if (!isFriend) {
          return res.status(403).json({ error: 'Send and accept a friend request before starting a chat.' });
        }

        chat = await createOrReturnDirectChat(userId, targetUserId);
      } else {
        joinUserSocketsToChat([userId, targetUserId], chat._id.toString());
      }

      const hydratedChat = await fetchChatByIdForUser(chat._id, userId);

      emitUserEvent([userId, targetUserId], 'chat:list:refresh');

      return res.status(201).json({ chat: hydratedChat });
    } catch (error) {
      console.error('Direct chat create error:', error);
      return res.status(500).json({ error: 'Unable to create direct chat.' });
    }
  });

  router.post('/chats/group', authRequired, groupMutationRateLimit, async (req, res) => {
    try {
      const creatorId = req.auth.sub;
      const name = String(req.body.name || '').trim();
      const rawParticipantIds = Array.isArray(req.body.participantIds) ? req.body.participantIds : [];
      const participantIds = rawParticipantIds.map(normalizeObjectId);

      if (name.length < 2 || name.length > 60) {
        return res.status(400).json({ error: 'Group name must be between 2 and 60 characters.' });
      }

      if (participantIds.length > MAX_GROUP_MEMBERS - 1) {
        return res.status(400).json({ error: `Groups can contain at most ${MAX_GROUP_MEMBERS} members.` });
      }

      if (participantIds.some((id) => !id)) {
        return res.status(400).json({ error: 'One or more selected users are invalid.' });
      }

      const uniqueMembers = new Set([creatorId]);
      participantIds.forEach((id) => {
        uniqueMembers.add(id);
      });

      if (uniqueMembers.size < 3) {
        return res
          .status(400)
          .json({ error: 'A group chat needs at least 3 members (including you).' });
      }

      const memberIds = Array.from(uniqueMembers);
      if (memberIds.length > MAX_GROUP_MEMBERS) {
        return res.status(400).json({ error: `Groups can contain at most ${MAX_GROUP_MEMBERS} members.` });
      }

      const existingUsers = await User.find({ _id: { $in: memberIds } }).select('_id');
      if (existingUsers.length !== memberIds.length) {
        return res.status(400).json({ error: 'One or more selected users do not exist.' });
      }

      const invitedMemberIds = memberIds.filter((memberId) => memberId !== creatorId);
      if (!(await areAcceptedFriends(creatorId, invitedMemberIds))) {
        return res.status(403).json({ error: 'You can only add accepted friends to a group.' });
      }

      const now = new Date();
      const chat = await Chat.create({
        type: 'group',
        name,
        members: memberIds.map((memberId) => ({
          user: memberId,
          lastReadAt: memberId === creatorId ? now : new Date(0),
        })),
        admins: [creatorId],
        createdBy: creatorId,
      });

      emitUserEvent(memberIds, 'chat:list:refresh');

      const hydratedChat = await fetchChatByIdForUser(chat._id, creatorId);
      return res.status(201).json({ chat: hydratedChat });
    } catch (error) {
      console.error('Group chat create error:', error);
      return res.status(500).json({ error: 'Unable to create group chat.' });
    }
  });

  router.patch('/chats/:chatId', authRequired, groupMutationRateLimit, async (req, res) => {
    try {
      const userId = req.auth.sub;
      const chatId = normalizeObjectId(req.params.chatId);

      if (!chatId) {
        return res.status(400).json({ error: 'Invalid chat ID.' });
      }

      const updateResult = await runChatOperationExclusive(chatId, async () => {
        const chat = await Chat.findById(chatId);
        if (!chat || !isChatMember(chat, userId)) {
          return { status: 404, error: 'Chat not found.' };
        }

        if (chat.type !== 'group') {
          return { status: 400, error: 'Only group chats can be updated.' };
        }

        if (!idList(chat.admins || []).includes(userId)) {
          return { status: 403, error: 'Only group admins can update group details.' };
        }

        const nextName = String(req.body.name || '').trim();
        if (!nextName || nextName.length < 2 || nextName.length > 60) {
          return { status: 400, error: 'Group name must be between 2 and 60 characters.' };
        }

        chat.name = nextName;
        await chat.save();
        return { chat, memberIds: chat.members.map((member) => member.user.toString()) };
      });

      if (updateResult.error) {
        return res.status(updateResult.status).json({ error: updateResult.error });
      }

      const { chat, memberIds } = updateResult;
      emitUserEvent(memberIds, 'chat:list:refresh');

      const hydratedChat = await fetchChatByIdForUser(chat._id, userId);
      return res.json({ chat: hydratedChat });
    } catch (error) {
      console.error('Group update error:', error);
      return res.status(500).json({ error: 'Unable to update chat.' });
    }
  });

  router.post('/chats/:chatId/members', authRequired, groupMutationRateLimit, async (req, res) => {
    try {
      const userId = req.auth.sub;
      const chatId = normalizeObjectId(req.params.chatId);
      const requestedMemberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds.map(normalizeObjectId) : [];

      if (!chatId) {
        return res.status(400).json({ error: 'Invalid chat ID.' });
      }

      if (requestedMemberIds.length === 0) {
        return res.status(400).json({ error: 'Select at least one member to add.' });
      }

      if (requestedMemberIds.length > MAX_GROUP_MEMBERS) {
        return res.status(400).json({ error: `Groups can contain at most ${MAX_GROUP_MEMBERS} members.` });
      }

      if (requestedMemberIds.some((memberId) => !memberId)) {
        return res.status(400).json({ error: 'One or more selected members are invalid.' });
      }

      const additionResult = await runChatOperationExclusive(chatId, async () => {
        const chat = await Chat.findById(chatId);
        if (!chat || !isChatMember(chat, userId)) {
          return { status: 404, error: 'Chat not found.' };
        }

        if (chat.type !== 'group') {
          return { status: 400, error: 'Only group chats can have members added.' };
        }

        if (!isGroupAdmin(chat, userId)) {
          return { status: 403, error: 'Only group admins can add members.' };
        }

        const existingMemberIds = new Set(getGroupMemberIds(chat));
        const memberIdsToAdd = Array.from(new Set(requestedMemberIds)).filter(
          (memberId) => !existingMemberIds.has(memberId)
        );

        if (memberIdsToAdd.length === 0) {
          return { status: 409, error: 'Selected users are already in this group.' };
        }

        if (existingMemberIds.size + memberIdsToAdd.length > MAX_GROUP_MEMBERS) {
          return { status: 400, error: `Groups can contain at most ${MAX_GROUP_MEMBERS} members.` };
        }

        const usersToAdd = await User.find({ _id: { $in: memberIdsToAdd } }).select('_id');
        if (usersToAdd.length !== memberIdsToAdd.length) {
          return { status: 400, error: 'One or more selected users do not exist.' };
        }

        if (!(await areAcceptedFriends(userId, memberIdsToAdd))) {
          return { status: 403, error: 'You can only add accepted friends to a group.' };
        }

        usersToAdd.forEach((user) => {
          chat.members.push({
            user: user._id,
            lastReadAt: new Date(0),
          });
        });

        await chat.save();
        joinUserSocketsToChat(memberIdsToAdd, chat._id.toString());
        return { chat, memberIdsToAdd, refreshedMemberIds: getGroupMemberIds(chat) };
      });

      if (additionResult.error) {
        return res.status(additionResult.status).json({ error: additionResult.error });
      }

      const { chat, memberIdsToAdd, refreshedMemberIds } = additionResult;
      emitUserEvent(refreshedMemberIds, 'chat:list:refresh');

      const hydratedChat = await fetchChatByIdForUser(chat._id, userId);
      return res.status(201).json({ chat: hydratedChat, addedMemberIds: memberIdsToAdd });
    } catch (error) {
      console.error('Group add members error:', error);
      return res.status(500).json({ error: 'Unable to add group members.' });
    }
  });

  router.delete('/chats/:chatId/members/:memberId', authRequired, groupMutationRateLimit, async (req, res) => {
    try {
      const userId = req.auth.sub;
      const chatId = normalizeObjectId(req.params.chatId);
      const targetMemberId = normalizeObjectId(req.params.memberId);

      if (!chatId || !targetMemberId) {
        return res.status(400).json({ error: 'Invalid chat or member ID.' });
      }

      const removalResult = await runChatOperationExclusive(chatId, async () => {
        const chat = await Chat.findById(chatId);
        if (!chat || !isChatMember(chat, userId)) {
          return { status: 404, error: 'Chat not found.' };
        }

        if (chat.type !== 'group') {
          return { status: 400, error: 'Only group chats can have members removed.' };
        }

        const currentMemberIds = getGroupMemberIds(chat);
        if (!currentMemberIds.includes(targetMemberId)) {
          return { status: 404, error: 'Member is not in this group.' };
        }

        const isSelfRemoval = targetMemberId === userId;
        if (!isSelfRemoval && !isGroupAdmin(chat, userId)) {
          return { status: 403, error: 'Only group admins can remove other members.' };
        }

        if (currentMemberIds.length <= 1) {
          return { status: 409, error: 'Cannot remove the last group member.' };
        }

        chat.members = chat.members.filter((member) => member.user.toString() !== targetMemberId);
        chat.admins = (chat.admins || []).filter((adminId) => adminId.toString() !== targetMemberId);

        if ((chat.admins || []).length === 0 && chat.members.length > 0) {
          chat.admins = [chat.members[0].user];
        }

        await chat.save();
        await leaveUserSocketsFromChat(targetMemberId, chat._id.toString());

        return {
          chat,
          currentMemberIds,
          isSelfRemoval,
        };
      });

      if (removalResult.error) {
        return res.status(removalResult.status).json({ error: removalResult.error });
      }

      emitUserEvent(removalResult.currentMemberIds, 'chat:list:refresh');

      const hydratedChat = removalResult.isSelfRemoval
        ? null
        : await fetchChatByIdForUser(removalResult.chat._id, userId);
      return res.json({ chat: hydratedChat, removedMemberId: targetMemberId });
    } catch (error) {
      console.error('Group remove member error:', error);
      return res.status(500).json({ error: 'Unable to remove group member.' });
    }
  });

  router.get('/chats/:chatId/messages', authRequired, messageHistoryRateLimit, limitInChatSearch, async (req, res) => {
    try {
      const userId = req.auth.sub;
      const chatId = normalizeObjectId(req.params.chatId);
      const query = String(req.query.query || '').trim();
      const pageSize = getMessagePageSize(req.query.limit);
      const cursor = String(req.query.cursor || '').trim();

      if (query.length > MAX_MESSAGE_QUERY_LENGTH) {
        return res.status(400).json({ error: 'Search query is too long.' });
      }

      if (cursor.length > MAX_CURSOR_LENGTH) {
        return res.status(400).json({ error: 'Invalid message cursor.' });
      }
      const decodedCursor = decodeMessageCursor(cursor);

      if (!chatId) {
        return res.status(400).json({ error: 'Invalid chat ID.' });
      }

      if (cursor && !decodedCursor) {
        return res.status(400).json({ error: 'Invalid message cursor.' });
      }

      const chat = await Chat.findById(chatId);
      if (!chat || !isChatMember(chat, userId)) {
        return res.status(404).json({ error: 'Chat not found.' });
      }

      const filters = { chat: chatId };
      if (query) {
        filters.text = { $regex: escapeRegExp(query), $options: 'i' };
      }

      if (decodedCursor) {
        filters.$or = [
          { createdAt: { $lt: decodedCursor.createdAt } },
          {
            createdAt: decodedCursor.createdAt,
            _id: { $lt: decodedCursor.id },
          },
        ];
      }

      const messages = await Message.find(filters)
        .sort({ createdAt: -1, _id: -1 })
        .limit(pageSize + 1)
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

      const hasMore = messages.length > pageSize;
      const pageMessages = messages.slice(0, pageSize);
      const displayMessages = [...pageMessages].reverse();
      const nextCursor = hasMore ? encodeMessageCursor(pageMessages[pageMessages.length - 1]) : '';

      if (!query && !decodedCursor) {
        const deliveredUpdates = await markMessagesDelivered(chatId, userId);
        emitStatusUpdates(chatId, deliveredUpdates);
      }

      return res.json({
        messages: displayMessages.map(serializeMessage),
        pageInfo: {
          hasMore,
          nextCursor,
          limit: pageSize,
        },
      });
    } catch (error) {
      console.error('Messages fetch error:', error);
      return res.status(500).json({ error: 'Unable to fetch messages.' });
    }
  });

  router.post('/chats/:chatId/read', authRequired, async (req, res) => {
    try {
      const userId = req.auth.sub;
      const chatId = normalizeObjectId(req.params.chatId);

      if (!chatId) {
        return res.status(400).json({ error: 'Invalid chat ID.' });
      }

      const chat = await Chat.findById(chatId);
      if (!chat || !isChatMember(chat, userId)) {
        return res.status(404).json({ error: 'Chat not found.' });
      }

      const seenUpdates = await markMessagesSeen(chatId, userId);
      emitStatusUpdates(chatId, seenUpdates);
      emitUserEvent([userId], 'chat:list:refresh');

      return res.json({
        seenCount: seenUpdates.length,
      });
    } catch (error) {
      console.error('Mark read error:', error);
      return res.status(500).json({ error: 'Unable to mark messages as read.' });
    }
  });

  return router;
}

module.exports = {
  createChatsRouter,
};
