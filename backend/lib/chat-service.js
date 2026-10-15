const crypto = require('crypto');
const mongoose = require('mongoose');
const { ALLOWED_UPLOAD_MEDIA_TYPES, parseDataUrlMetadata } = require('./file-validation');
const { normalizeObjectId } = require('./object-id');
const CLOUDINARY_DELIVERY_HOST = 'res.cloudinary.com';
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENT_DATA_URL_BYTES = 128 * 1024;
const MAX_ATTACHMENT_FILE_NAME_LENGTH = 180;
const MAX_ATTACHMENT_PUBLIC_ID_LENGTH = 255;
const MAX_ATTACHMENT_URL_LENGTH = 2048;
const MAX_CHAT_LIST_SIZE = 200;
const MAX_FRIEND_OVERVIEW_ITEMS = 200;
const MAX_STATUS_UPDATE_EVENTS = 200;
const ALLOWED_ATTACHMENT_RESOURCE_TYPES = new Set(['image', 'raw', 'video']);
const PERSISTED_UPLOAD_RESOURCE_TYPES = new Set(['image', 'raw']);
const MAX_PENDING_UPLOAD_CLEANUP_BATCH = 100;

function createCodedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isAllowedAttachmentDataUrl(value) {
  const metadata = parseDataUrlMetadata(value, { maxBytes: MAX_ATTACHMENT_DATA_URL_BYTES });
  return Boolean(metadata && ALLOWED_UPLOAD_MEDIA_TYPES.has(metadata.mediaType));
}

function getSafeAttachmentUrl(value, { allowDataUrlFallback, cloudinaryCloudName }) {
  const rawUrl = String(value || '').trim();
  const normalizedUrl = rawUrl.toLowerCase();

  if (!rawUrl) {
    return '';
  }

  if (normalizedUrl.startsWith('data:')) {
    return allowDataUrlFallback && isAllowedAttachmentDataUrl(rawUrl) ? rawUrl : '';
  }

  if (rawUrl.length > MAX_ATTACHMENT_URL_LENGTH || !cloudinaryCloudName) {
    return '';
  }

  try {
    const parsedUrl = new URL(rawUrl);
    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    const assetCloudName = pathSegments[0] ? decodeURIComponent(pathSegments[0]) : '';
    const resourceType = pathSegments[1] || '';
    const deliveryType = pathSegments[2] || '';
    const version = pathSegments[3] || '';
    const assetPath = pathSegments.slice(4);
    const hasUnsafeAssetSegment = assetPath.some((segment) => {
      try {
        const decodedSegment = decodeURIComponent(segment);
        return (
          !decodedSegment ||
          decodedSegment === '.' ||
          decodedSegment === '..' ||
          decodedSegment.includes('/') ||
          decodedSegment.includes('\\') ||
          decodedSegment.includes('\0') ||
          decodedSegment.length > 255
        );
      } catch (_error) {
        return true;
      }
    });

    if (
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.hostname.toLowerCase() !== CLOUDINARY_DELIVERY_HOST ||
      parsedUrl.port ||
      parsedUrl.username ||
      parsedUrl.password ||
      parsedUrl.search ||
      parsedUrl.hash ||
      assetCloudName !== cloudinaryCloudName ||
      !ALLOWED_ATTACHMENT_RESOURCE_TYPES.has(resourceType) ||
      deliveryType !== 'upload' ||
      pathSegments.length < 5 ||
      !/^v\d+$/.test(version) ||
      hasUnsafeAssetSegment
    ) {
      return '';
    }

    return parsedUrl.toString();
  } catch (_error) {
    return '';
  }
}

function sanitizeAttachmentFileName(value) {
  return String(value || '')
    .trim()
    .replace(/[\\/\0\r\n\t]/g, '_')
    .slice(0, MAX_ATTACHMENT_FILE_NAME_LENGTH);
}

function getAttachmentResourceType(safeUrl) {
  if (safeUrl.toLowerCase().startsWith('data:')) {
    return safeUrl.toLowerCase().startsWith('data:image/') ? 'image' : 'raw';
  }

  try {
    const resourceType = new URL(safeUrl).pathname.split('/').filter(Boolean)[1] || '';
    return ALLOWED_ATTACHMENT_RESOURCE_TYPES.has(resourceType) ? resourceType : 'raw';
  } catch (_error) {
    return 'raw';
  }
}

function createChatService({
  io,
  models,
  realtime,
  cloudinaryCloudName,
  cloudinaryApiKey = '',
  cloudinaryApiSecret = '',
  cloudinaryUploadPreset,
  allowDataUrlFallback = false,
  uploadLimits = {},
}) {
  const { Chat, FriendRequest, Message, UploadAsset, UploadQuota } = models;
  const resolvedUploadLimits = {
    cleanupIntervalSeconds: Number(uploadLimits.cleanupIntervalSeconds) || 60 * 60,
    dailyMaxBytes: Number(uploadLimits.dailyMaxBytes) || 100 * 1024 * 1024,
    dailyMaxFiles: Number(uploadLimits.dailyMaxFiles) || 50,
    pendingTtlSeconds: Number(uploadLimits.pendingTtlSeconds) || 24 * 60 * 60,
    totalMaxBytes: Number(uploadLimits.totalMaxBytes) || 500 * 1024 * 1024,
    totalMaxFiles: Number(uploadLimits.totalMaxFiles) || 500,
  };

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function normalizeAttachment(attachment) {
    if (!attachment) {
      return null;
    }

    const attachmentUrlOptions = { allowDataUrlFallback, cloudinaryCloudName };
    const safeUrl = getSafeAttachmentUrl(attachment.url, attachmentUrlOptions);
    const safeSecureUrl = getSafeAttachmentUrl(attachment.secureUrl, attachmentUrlOptions);
    const resolvedUrl = safeSecureUrl || safeUrl;
    const bytes = Number(attachment.bytes || 0);

    if (!resolvedUrl) {
      return null;
    }

    return {
      uploadId: normalizeObjectId(attachment.uploadId || attachment._id) || null,
      url: resolvedUrl,
      secureUrl: resolvedUrl.toLowerCase().startsWith('data:') ? '' : resolvedUrl,
      publicId: String(attachment.publicId || '').trim().slice(0, MAX_ATTACHMENT_PUBLIC_ID_LENGTH),
      fileName: sanitizeAttachmentFileName(attachment.fileName),
      resourceType: getAttachmentResourceType(resolvedUrl),
      bytes: Number.isFinite(bytes) && bytes > 0 && bytes <= MAX_ATTACHMENT_BYTES ? Math.floor(bytes) : 0,
      format: String(attachment.format || '').trim().slice(0, 40),
    };
  }

  function idList(values = []) {
    return values.map((value) => value.toString());
  }

  function serializeUser(user, options = null) {
    if (!user) {
      return null;
    }

    const id = user._id ? user._id.toString() : user.id?.toString();
    const includePresence = !options || typeof options !== 'object' || options.includePresence !== false;
    const serializedUser = {
      id,
      username: user.username || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
    };

    if (!includePresence) {
      return serializedUser;
    }

    const resolvedIsOnline = id ? realtime.getLiveSocketIdsForUser(id).length > 0 : Boolean(user.isOnline);

    return {
      ...serializedUser,
      isOnline: resolvedIsOnline,
      lastSeen: resolvedIsOnline ? null : user.lastSeen || null,
    };
  }

  function serializeUserValue(user, options = null) {
    if (!user) {
      return null;
    }

    if (user.username !== undefined || user._id || user.id) {
      return serializeUser(user, options);
    }

    const serializedUser = {
      id: user.toString(),
      username: '',
      firstName: '',
      lastName: '',
    };

    if (options && typeof options === 'object' && options.includePresence === false) {
      return serializedUser;
    }

    return {
      ...serializedUser,
      isOnline: false,
      lastSeen: null,
    };
  }

  function getUserDisplayName(user) {
    const fullName = [user?.firstName, user?.lastName]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(' ');

    return fullName || user?.username || '';
  }

  function serializeReply(replyDoc) {
    if (!replyDoc || !replyDoc._id) {
      return null;
    }

    return {
      id: replyDoc._id.toString(),
      text: replyDoc.text || '',
      sender: replyDoc.sender ? serializeUser(replyDoc.sender) : null,
      createdAt: replyDoc.createdAt || null,
    };
  }

  function serializeMessage(message) {
    if (!message) {
      return null;
    }

    const sender = message.sender && message.sender.username ? message.sender : null;

    return {
      id: message._id.toString(),
      chatId: message.chat?.toString?.() || String(message.chat),
      sender: sender
        ? serializeUser(sender)
        : {
            id: message.sender?.toString?.() || String(message.sender),
            username: '',
            firstName: '',
            lastName: '',
            isOnline: false,
            lastSeen: null,
          },
      text: message.text || '',
      attachments: Array.isArray(message.attachments) ? message.attachments.map(normalizeAttachment).filter(Boolean) : [],
      replyTo: serializeReply(message.replyTo),
      deliveredTo: idList(message.deliveredTo || []),
      seenBy: idList(message.seenBy || []),
      createdAt: message.createdAt,
      updatedAt: message.updatedAt,
    };
  }

  function serializeChat(chat, viewerId, unreadCount = 0) {
    const members = (chat.members || []).map((member) => {
      const memberUser = member.user && member.user.username ? member.user : null;
      const serialized = memberUser
        ? serializeUser(memberUser)
        : {
            id: member.user?.toString?.() || String(member.user),
            username: '',
            firstName: '',
            lastName: '',
            isOnline: false,
            lastSeen: null,
          };

      return {
        ...serialized,
        lastReadAt: member.lastReadAt || null,
        joinedAt: member.joinedAt || null,
      };
    });

    const directOtherMember = chat.type === 'direct' ? members.find((member) => member.id !== viewerId) : null;

    return {
      id: chat._id.toString(),
      type: chat.type,
      name:
        chat.type === 'group'
          ? chat.name || 'Untitled Group'
          : getUserDisplayName(directOtherMember) || chat.name || 'Direct Chat',
      customName: chat.name || '',
      members,
      admins: idList(chat.admins || []),
      createdBy: chat.createdBy?.toString?.() || String(chat.createdBy),
      unreadCount,
      lastMessage: serializeMessage(chat.lastMessage),
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    };
  }

  function buildPairKey(leftUserId, rightUserId) {
    const leftId = normalizeObjectId(leftUserId);
    const rightId = normalizeObjectId(rightUserId);
    if (!leftId || !rightId) {
      throw new TypeError('Pair keys require valid user IDs.');
    }

    return [leftId, rightId].sort().join(':');
  }

  async function findDirectChat(userId, targetUserId) {
    const pairKey = buildPairKey(userId, targetUserId);
    const keyedChat = await Chat.findOne({ type: 'direct', pairKey });
    if (keyedChat) {
      return keyedChat;
    }

    const legacyChat = await Chat.findOne({
      type: 'direct',
      'members.user': { $all: [userId, targetUserId] },
      $expr: { $eq: [{ $size: '$members' }, 2] },
    });

    if (!legacyChat) {
      return null;
    }

    try {
      await Chat.updateOne(
        { _id: legacyChat._id, pairKey: { $exists: false } },
        { $set: { pairKey } }
      );
      legacyChat.pairKey = pairKey;
      return legacyChat;
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }

      return Chat.findOne({ type: 'direct', pairKey });
    }
  }

  async function createOrReturnDirectChat(userId, targetUserId) {
    let chat = await findDirectChat(userId, targetUserId);

    if (!chat) {
      const now = new Date();
      const pairKey = buildPairKey(userId, targetUserId);
      const directChatId = crypto.createHash('sha256').update(pairKey).digest('hex').slice(0, 24);

      try {
        chat = await Chat.findOneAndUpdate(
          { _id: directChatId, type: 'direct', pairKey },
          {
            $setOnInsert: {
              type: 'direct',
              pairKey,
              members: [
                { user: userId, lastReadAt: now },
                { user: targetUserId, lastReadAt: new Date(0) },
              ],
              admins: [userId],
              createdBy: userId,
            },
          },
          { new: true, setDefaultsOnInsert: true, upsert: true }
        );
      } catch (error) {
        if (error?.code !== 11000) {
          throw error;
        }

        chat = await findDirectChat(userId, targetUserId);
      }
    }

    if (!chat) {
      throw new Error('Unable to create direct chat.');
    }

    realtime.joinUserSocketsToChat([userId, targetUserId], chat._id.toString());

    return chat;
  }

  async function hasAcceptedFriendship(userId, targetUserId) {
    const friendship = await FriendRequest.findOne({
      pairKey: buildPairKey(userId, targetUserId),
      status: 'accepted',
    }).select('_id');

    return Boolean(friendship);
  }

  function serializeFriendRequest(request, viewerId) {
    const userSerializationOptions = request.status === 'accepted' ? null : { includePresence: false };
    const requester = serializeUserValue(request.requester, userSerializationOptions);
    const recipient = serializeUserValue(request.recipient, userSerializationOptions);
    const otherUser = requester?.id === viewerId ? recipient : requester;

    return {
      id: request._id.toString(),
      status: request.status,
      actedAt: request.actedAt || null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      requester,
      recipient,
      user: otherUser,
    };
  }

  async function fetchFriendOverview(userId) {
    const [acceptedRequests, incomingRequests, outgoingRequests, directChats] = await Promise.all([
      FriendRequest.find({
        status: 'accepted',
        $or: [{ requester: userId }, { recipient: userId }],
      })
        .sort({ updatedAt: -1 })
        .limit(MAX_FRIEND_OVERVIEW_ITEMS)
        .populate('requester', 'username firstName lastName isOnline lastSeen')
        .populate('recipient', 'username firstName lastName isOnline lastSeen'),
      FriendRequest.find({
        recipient: userId,
        status: 'pending',
      })
        .sort({ createdAt: -1 })
        .limit(MAX_FRIEND_OVERVIEW_ITEMS)
        .populate('requester', 'username firstName lastName')
        .populate('recipient', 'username firstName lastName'),
      FriendRequest.find({
        requester: userId,
        status: 'pending',
      })
        .sort({ createdAt: -1 })
        .limit(MAX_FRIEND_OVERVIEW_ITEMS)
        .populate('requester', 'username firstName lastName')
        .populate('recipient', 'username firstName lastName'),
      Chat.find({
        type: 'direct',
        'members.user': userId,
        $expr: { $eq: [{ $size: '$members' }, 2] },
      })
        .sort({ updatedAt: -1 })
        .limit(MAX_FRIEND_OVERVIEW_ITEMS)
        .select('_id members.user updatedAt')
        .populate('members.user', 'username firstName lastName isOnline lastSeen'),
    ]);

    const friendsById = new Map();

    acceptedRequests.forEach((request) => {
      const serializedRequest = serializeFriendRequest(request, userId);
      if (!serializedRequest.user?.id) {
        return;
      }

      friendsById.set(serializedRequest.user.id, {
        ...serializedRequest.user,
        chatId: null,
      });
    });

    directChats.forEach((chat) => {
      const otherMember = (chat.members || []).find((member) => serializeUserValue(member.user)?.id !== userId);
      const otherUser = serializeUserValue(otherMember?.user);

      if (!otherUser?.id) {
        return;
      }

      const existingFriend = friendsById.get(otherUser.id) || {};

      friendsById.set(otherUser.id, {
        ...existingFriend,
        ...otherUser,
        chatId: chat._id.toString(),
      });
    });

    const friends = Array.from(friendsById.values()).sort((leftUser, rightUser) =>
      leftUser.username.localeCompare(rightUser.username, undefined, { sensitivity: 'base' })
    );

    return {
      friends,
      incomingRequests: incomingRequests.map((request) => serializeFriendRequest(request, userId)),
      outgoingRequests: outgoingRequests.map((request) => serializeFriendRequest(request, userId)),
    };
  }

  function isChatMember(chat, userId) {
    return (chat.members || []).some((member) => member.user?.toString() === userId);
  }

  async function computeUnreadCount(chat, userId) {
    return Message.countDocuments({
      chat: chat._id,
      sender: { $ne: userId },
      seenBy: { $ne: userId },
    });
  }

  async function fetchChatByIdForUser(chatId, userId) {
    const chat = await Chat.findById(chatId)
      .populate('members.user', 'username firstName lastName isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        populate: [
          {
            path: 'sender',
            select: 'username firstName lastName isOnline lastSeen',
          },
        ],
      });

    if (!chat || !isChatMember(chat, userId)) {
      return null;
    }

    const unreadCount = await computeUnreadCount(chat, userId);
    return serializeChat(chat, userId, unreadCount);
  }

  async function fetchChatsForUser(userId) {
    const chats = await Chat.find({ 'members.user': userId })
      .sort({ updatedAt: -1 })
      .limit(MAX_CHAT_LIST_SIZE)
      .populate('members.user', 'username firstName lastName isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        populate: [
          {
            path: 'sender',
            select: 'username firstName lastName isOnline lastSeen',
          },
        ],
      });

    if (chats.length === 0) {
      return [];
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const unreadCounts = await Message.aggregate([
      {
        $match: {
          chat: { $in: chats.map((chat) => chat._id) },
          sender: { $ne: userObjectId },
          seenBy: { $ne: userObjectId },
        },
      },
      {
        $group: {
          _id: '$chat',
          count: { $sum: 1 },
        },
      },
    ]);
    const unreadCountByChatId = new Map(
      unreadCounts.map((entry) => [entry._id.toString(), Number(entry.count) || 0])
    );

    return chats.map((chat) => serializeChat(chat, userId, unreadCountByChatId.get(chat._id.toString()) || 0));
  }

  async function markMessagesDelivered(chatId, userId) {
    const missingDelivery = await Message.find({
      chat: chatId,
      sender: { $ne: userId },
      deliveredTo: { $ne: userId },
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(MAX_STATUS_UPDATE_EVENTS)
      .select('_id deliveredTo seenBy');

    if (missingDelivery.length === 0) {
      return [];
    }

    await Message.updateMany(
      {
        _id: { $in: missingDelivery.map((message) => message._id) },
        chat: chatId,
        sender: { $ne: userId },
        deliveredTo: { $ne: userId },
      },
      {
        $addToSet: { deliveredTo: userId },
      }
    );

    return missingDelivery.map((message) => ({
      chatId: chatId.toString(),
      messageId: message._id.toString(),
      deliveredTo: Array.from(new Set([...idList(message.deliveredTo), userId])),
      seenBy: idList(message.seenBy || []),
    }));
  }

  async function markMessagesSeen(chatId, userId) {
    const seenAt = new Date();

    await Chat.updateOne(
      { _id: chatId, 'members.user': userId },
      { $set: { 'members.$.lastReadAt': seenAt } }
    );

    const unseenMessages = await Message.find({
      chat: chatId,
      sender: { $ne: userId },
      seenBy: { $ne: userId },
    })
      .sort({ createdAt: -1, _id: -1 })
      .limit(MAX_STATUS_UPDATE_EVENTS)
      .select('_id deliveredTo seenBy');

    if (unseenMessages.length === 0) {
      return [];
    }

    await Message.updateMany(
      {
        _id: { $in: unseenMessages.map((message) => message._id) },
        chat: chatId,
        sender: { $ne: userId },
        seenBy: { $ne: userId },
      },
      {
        $addToSet: {
          seenBy: userId,
          deliveredTo: userId,
        },
      }
    );

    return unseenMessages.map((message) => ({
      chatId: chatId.toString(),
      messageId: message._id.toString(),
      deliveredTo: Array.from(new Set([...idList(message.deliveredTo), userId])),
      seenBy: Array.from(new Set([...idList(message.seenBy), userId])),
    }));
  }

  async function syncChatLastMessage(chat) {
    if (!chat?._id) {
      return;
    }

    const latestMessage = await Message.findOne({ chat: chat._id }).sort({ createdAt: -1 }).select('_id createdAt');

    await Chat.findByIdAndUpdate(chat._id, {
      $set: {
        lastMessage: latestMessage?._id || null,
        updatedAt: latestMessage?.createdAt || chat.createdAt || new Date(),
      },
    });
  }

  function emitStatusUpdates(chatId, statusUpdates = []) {
    statusUpdates.forEach((status) => {
      io.to(`chat:${chatId}`).emit('message:status', status);
    });
  }

  function requireUploadModels() {
    if (!UploadAsset || !UploadQuota) {
      throw new Error('Upload persistence models are not configured.');
    }
  }

  function getUtcDayStart(date = new Date()) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  function createCloudinarySignature(parameters) {
    if (!cloudinaryApiSecret) {
      throw new Error('Cloudinary signing credentials are not configured.');
    }

    const signaturePayload = Object.entries(parameters)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    return crypto.createHash('sha1').update(`${signaturePayload}${cloudinaryApiSecret}`).digest('hex');
  }

  async function performCloudinaryRequest(endpoint, signedParameters, extraParameters = {}) {
    const payload = new URLSearchParams();
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 15_000);

    Object.entries({ ...signedParameters, ...extraParameters }).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        payload.append(key, String(value));
      }
    });
    payload.append('api_key', cloudinaryApiKey);
    payload.append('signature', createCloudinarySignature(signedParameters));

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: payload,
        signal: abortController.signal,
      });
      const result = await response.json();

      if (!response.ok) {
        console.error('Cloudinary request rejected:', result?.error?.message || response.statusText);
        throw createCodedError('Cloudinary request failed.', 'CLOUDINARY_REQUEST_REJECTED');
      }

      return result;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('Cloudinary request timed out.');
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function uploadToCloudinary({ dataUrl, publicId, resourceType }) {
    if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
      throw new Error('Cloudinary signing credentials are not configured.');
    }

    if (
      !publicId ||
      !PERSISTED_UPLOAD_RESOURCE_TYPES.has(resourceType) ||
      String(publicId).length > MAX_ATTACHMENT_PUBLIC_ID_LENGTH
    ) {
      throw createCodedError('Invalid Cloudinary upload intent.', 'INVALID_UPLOAD');
    }

    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryCloudName)}/${resourceType}/upload`;
    const signedParameters = {
      public_id: publicId,
      timestamp: Math.floor(Date.now() / 1000),
    };

    if (cloudinaryUploadPreset) {
      signedParameters.upload_preset = cloudinaryUploadPreset;
    }

    try {
      return await performCloudinaryRequest(endpoint, signedParameters, { file: dataUrl });
    } catch (error) {
      if (error?.code === 'CLOUDINARY_REQUEST_REJECTED') {
        throw error;
      }

      const ambiguousError = createCodedError(
        'Cloudinary upload status could not be confirmed.',
        'CLOUDINARY_UPLOAD_AMBIGUOUS'
      );
      ambiguousError.cause = error;
      throw ambiguousError;
    }
  }

  async function destroyCloudinaryAsset({ publicId, resourceType }) {
    if (!publicId || !ALLOWED_ATTACHMENT_RESOURCE_TYPES.has(resourceType)) {
      throw new Error('Invalid Cloudinary asset metadata.');
    }

    const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryCloudName)}/${resourceType}/destroy`;
    const signedParameters = {
      invalidate: 'true',
      public_id: publicId,
      timestamp: Math.floor(Date.now() / 1000),
    };
    const result = await performCloudinaryRequest(endpoint, signedParameters);

    if (result?.result !== 'ok' && result?.result !== 'not found') {
      throw new Error('Cloudinary asset deletion failed.');
    }

    return result;
  }

  async function reserveUploadQuota(ownerId, bytes, { reservationId } = {}) {
    requireUploadModels();

    const normalizedOwnerId = normalizeObjectId(ownerId);
    const normalizedReservationId = normalizeObjectId(reservationId);
    const normalizedBytes = Number(bytes);
    if (
      !normalizedOwnerId ||
      !normalizedReservationId ||
      !Number.isSafeInteger(normalizedBytes) ||
      normalizedBytes < 1
    ) {
      throw createCodedError('Invalid upload quota request.', 'INVALID_UPLOAD');
    }
    const reservationObjectId = new mongoose.Types.ObjectId(normalizedReservationId);

    if (
      normalizedBytes > resolvedUploadLimits.dailyMaxBytes ||
      normalizedBytes > resolvedUploadLimits.totalMaxBytes
    ) {
      throw createCodedError('This file exceeds your upload quota.', 'UPLOAD_QUOTA_EXCEEDED');
    }

    const dailyWindowStart = getUtcDayStart();
    try {
      await UploadQuota.updateOne(
        { owner: normalizedOwnerId },
        {
          $setOnInsert: {
            owner: normalizedOwnerId,
            totalFiles: 0,
            totalBytes: 0,
            dailyWindowStart,
            dailyFiles: 0,
            dailyBytes: 0,
            reservations: [],
          },
        },
        { upsert: true }
      );
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }

    await UploadQuota.updateOne(
      { owner: normalizedOwnerId, dailyWindowStart: { $lt: dailyWindowStart } },
      {
        $set: {
          dailyWindowStart,
          dailyFiles: 0,
          dailyBytes: 0,
        },
      }
    );

    const quota = await UploadQuota.findOneAndUpdate(
      {
        owner: normalizedOwnerId,
        dailyWindowStart,
        dailyFiles: { $lt: resolvedUploadLimits.dailyMaxFiles },
        dailyBytes: { $lte: resolvedUploadLimits.dailyMaxBytes - normalizedBytes },
        totalFiles: { $lt: resolvedUploadLimits.totalMaxFiles },
        totalBytes: { $lte: resolvedUploadLimits.totalMaxBytes - normalizedBytes },
        reservations: { $ne: reservationObjectId },
      },
      {
        $addToSet: { reservations: reservationObjectId },
        $inc: {
          dailyFiles: 1,
          dailyBytes: normalizedBytes,
          totalFiles: 1,
          totalBytes: normalizedBytes,
        },
      },
      { new: true }
    );

    if (!quota) {
      throw createCodedError('Upload quota exceeded.', 'UPLOAD_QUOTA_EXCEEDED');
    }

    return {
      ownerId: normalizedOwnerId,
      bytes: normalizedBytes,
      dailyWindowStart,
      reservationId: normalizedReservationId,
    };
  }

  async function releaseUploadQuota(reservation, { releaseDaily = false } = {}) {
    if (!UploadQuota || !reservation?.ownerId || !reservation?.bytes || !reservation?.reservationId) {
      return false;
    }

    const normalizedReservationId = normalizeObjectId(reservation.reservationId);
    if (!normalizedReservationId) {
      return false;
    }
    const reservationObjectId = new mongoose.Types.ObjectId(normalizedReservationId);

    const updateFields = {
      reservations: {
        $filter: {
          input: { $ifNull: ['$reservations', []] },
          as: 'reservation',
          cond: { $ne: ['$$reservation', reservationObjectId] },
        },
      },
      totalFiles: { $max: [0, { $subtract: ['$totalFiles', 1] }] },
      totalBytes: { $max: [0, { $subtract: ['$totalBytes', reservation.bytes] }] },
    };

    if (releaseDaily) {
      const isSameDailyWindow = { $eq: ['$dailyWindowStart', reservation.dailyWindowStart] };
      updateFields.dailyFiles = {
        $cond: [isSameDailyWindow, { $max: [0, { $subtract: ['$dailyFiles', 1] }] }, '$dailyFiles'],
      };
      updateFields.dailyBytes = {
        $cond: [
          isSameDailyWindow,
          { $max: [0, { $subtract: ['$dailyBytes', reservation.bytes] }] },
          '$dailyBytes',
        ],
      };
    }

    const quota = await UploadQuota.findOneAndUpdate(
      { owner: reservation.ownerId, reservations: reservationObjectId },
      [{ $set: updateFields }],
      { new: true }
    );
    return Boolean(quota);
  }

  function serializeUploadAsset(asset) {
    if (!asset) {
      return null;
    }

    return {
      uploadId: asset._id.toString(),
      url: asset.url,
      secureUrl: asset.secureUrl || '',
      publicId: asset.publicId || '',
      fileName: asset.fileName || '',
      resourceType: asset.resourceType,
      bytes: asset.bytes,
      format: asset.format || '',
    };
  }

  async function createCloudinaryUploadIntent({ ownerId, fileName, mediaType, bytes }) {
    requireUploadModels();

    const normalizedOwnerId = normalizeObjectId(ownerId);
    const normalizedBytes = Number(bytes);
    const resourceType = String(mediaType || '').startsWith('image/') ? 'image' : 'raw';
    if (
      !normalizedOwnerId ||
      !Number.isSafeInteger(normalizedBytes) ||
      normalizedBytes < 1 ||
      normalizedBytes > MAX_ATTACHMENT_BYTES
    ) {
      throw createCodedError('Invalid upload intent.', 'INVALID_UPLOAD');
    }

    const publicId = `confabulate/${normalizedOwnerId}/${crypto.randomUUID()}`;
    const asset = await UploadAsset.create({
      owner: normalizedOwnerId,
      provider: 'cloudinary',
      status: 'uploading',
      url: '',
      secureUrl: '',
      publicId,
      fileName: sanitizeAttachmentFileName(fileName) || 'attachment',
      mediaType,
      resourceType,
      bytes: normalizedBytes,
      format: '',
      pendingExpiresAt: new Date(Date.now() + resolvedUploadLimits.pendingTtlSeconds * 1000),
    });

    return {
      uploadId: asset._id.toString(),
      publicId,
      resourceType,
    };
  }

  async function completeCloudinaryUpload({ uploadId, ownerId, file, mediaType }) {
    requireUploadModels();

    const normalizedUploadId = normalizeObjectId(uploadId);
    const normalizedOwnerId = normalizeObjectId(ownerId);
    const normalizedFile = normalizeAttachment(file);
    if (
      !normalizedUploadId ||
      !normalizedOwnerId ||
      !normalizedFile ||
      !PERSISTED_UPLOAD_RESOURCE_TYPES.has(normalizedFile.resourceType) ||
      !Number.isSafeInteger(normalizedFile.bytes) ||
      normalizedFile.bytes < 1
    ) {
      throw createCodedError('Invalid uploaded asset metadata.', 'INVALID_UPLOAD');
    }

    const asset = await UploadAsset.findOneAndUpdate(
      {
        _id: normalizedUploadId,
        owner: normalizedOwnerId,
        provider: 'cloudinary',
        status: 'uploading',
        publicId: normalizedFile.publicId,
        resourceType: normalizedFile.resourceType,
      },
      {
        $set: {
          status: 'pending',
          url: normalizedFile.url,
          secureUrl: normalizedFile.secureUrl,
          fileName: normalizedFile.fileName,
          mediaType,
          format: normalizedFile.format,
          pendingExpiresAt: new Date(Date.now() + resolvedUploadLimits.pendingTtlSeconds * 1000),
        },
      },
      { new: true }
    );

    if (!asset) {
      throw createCodedError('Upload intent is unavailable.', 'INVALID_UPLOAD');
    }

    return serializeUploadAsset(asset);
  }

  async function recordPendingUpload({ ownerId, provider, file, mediaType }) {
    requireUploadModels();

    const normalizedOwnerId = normalizeObjectId(ownerId);
    const normalizedFile = normalizeAttachment(file);
    if (
      !normalizedOwnerId ||
      !normalizedFile ||
      !PERSISTED_UPLOAD_RESOURCE_TYPES.has(normalizedFile.resourceType) ||
      !Number.isSafeInteger(normalizedFile.bytes) ||
      normalizedFile.bytes < 1
    ) {
      throw createCodedError('Invalid uploaded asset metadata.', 'INVALID_UPLOAD');
    }

    const asset = await UploadAsset.create({
      owner: normalizedOwnerId,
      provider,
      status: 'pending',
      url: normalizedFile.url,
      secureUrl: normalizedFile.secureUrl,
      publicId: normalizedFile.publicId,
      fileName: normalizedFile.fileName,
      mediaType,
      resourceType: normalizedFile.resourceType,
      bytes: normalizedFile.bytes,
      format: normalizedFile.format,
      pendingExpiresAt: new Date(Date.now() + resolvedUploadLimits.pendingTtlSeconds * 1000),
    });

    return serializeUploadAsset(asset);
  }

  async function claimPendingAttachments({ attachments, messageId, ownerId }) {
    requireUploadModels();

    const normalizedOwnerId = normalizeObjectId(ownerId);
    const normalizedMessageId = normalizeObjectId(messageId);
    const requestedAttachments = Array.isArray(attachments) ? attachments : [];
    if (!normalizedOwnerId || !normalizedMessageId || requestedAttachments.length > 8) {
      throw createCodedError('Invalid message attachments.', 'INVALID_UPLOAD_ATTACHMENT');
    }

    if (requestedAttachments.length === 0) {
      return [];
    }

    const uploadIds = requestedAttachments.map((attachment) => normalizeObjectId(attachment?.uploadId));
    if (uploadIds.some((uploadId) => !uploadId) || new Set(uploadIds).size !== uploadIds.length) {
      throw createCodedError('Invalid message attachments.', 'INVALID_UPLOAD_ATTACHMENT');
    }

    const claimedAssetIds = [];
    const claimedAttachments = [];
    const now = new Date();

    try {
      for (const uploadId of uploadIds) {
        const asset = await UploadAsset.findOneAndUpdate(
          {
            _id: uploadId,
            owner: normalizedOwnerId,
            status: 'pending',
            pendingExpiresAt: { $gt: now },
          },
          {
            $set: {
              status: 'claiming',
              message: normalizedMessageId,
              claimStartedAt: now,
            },
          },
          { new: true }
        );

        if (!asset) {
          throw createCodedError('An attachment is unavailable or does not belong to this user.', 'INVALID_UPLOAD_ATTACHMENT');
        }

        claimedAssetIds.push(asset._id);
        claimedAttachments.push(serializeUploadAsset(asset));
      }

      return claimedAttachments;
    } catch (error) {
      if (claimedAssetIds.length > 0) {
        await UploadAsset.updateMany(
          {
            _id: { $in: claimedAssetIds },
            owner: normalizedOwnerId,
            status: 'claiming',
            message: normalizedMessageId,
          },
          {
            $set: {
              status: 'pending',
              pendingExpiresAt: new Date(Date.now() + resolvedUploadLimits.pendingTtlSeconds * 1000),
            },
            $unset: { message: '', claimStartedAt: '' },
          }
        );
      }

      throw error;
    }
  }

  async function finalizeMessageAttachments({ messageId, ownerId }) {
    if (!UploadAsset) {
      return;
    }

    const normalizedOwnerId = normalizeObjectId(ownerId);
    const normalizedMessageId = normalizeObjectId(messageId);
    if (!normalizedOwnerId || !normalizedMessageId) {
      return;
    }

    await UploadAsset.updateMany(
      {
        owner: normalizedOwnerId,
        status: 'claiming',
        message: normalizedMessageId,
      },
      {
        $set: {
          status: 'attached',
          attachedAt: new Date(),
        },
        $unset: { claimStartedAt: '', pendingExpiresAt: '' },
      }
    );
  }

  async function releaseMessageAttachments({ messageId, ownerId }) {
    if (!UploadAsset) {
      return;
    }

    const normalizedOwnerId = normalizeObjectId(ownerId);
    const normalizedMessageId = normalizeObjectId(messageId);
    if (!normalizedOwnerId || !normalizedMessageId) {
      return;
    }

    await UploadAsset.updateMany(
      {
        owner: normalizedOwnerId,
        status: 'claiming',
        message: normalizedMessageId,
      },
      {
        $set: {
          status: 'pending',
          pendingExpiresAt: new Date(Date.now() + resolvedUploadLimits.pendingTtlSeconds * 1000),
        },
        $unset: { message: '', claimStartedAt: '' },
      }
    );
  }

  async function deleteTrackedUploadAsset(asset, { now = new Date() } = {}) {
    if (!asset?._id || asset.status !== 'deleting') {
      return false;
    }

    if (asset.provider === 'cloudinary') {
      await destroyCloudinaryAsset({ publicId: asset.publicId, resourceType: asset.resourceType });
    }

    await releaseUploadQuota({
      ownerId: asset.owner.toString(),
      bytes: asset.bytes,
      reservationId: asset._id.toString(),
    });

    const deletionResult = await UploadAsset.deleteOne({ _id: asset._id, status: 'deleting' });
    return deletionResult.deletedCount === 1;
  }

  async function discardUploadAsset({ uploadId, ownerId }) {
    if (!UploadAsset) {
      return false;
    }

    const normalizedUploadId = normalizeObjectId(uploadId);
    const normalizedOwnerId = normalizeObjectId(ownerId);
    if (!normalizedUploadId || !normalizedOwnerId) {
      return false;
    }

    const now = new Date();
    const asset = await UploadAsset.findOneAndUpdate(
      {
        _id: normalizedUploadId,
        owner: normalizedOwnerId,
        status: { $in: ['uploading', 'pending'] },
      },
      { $set: { status: 'deleting', deletionStartedAt: now } },
      { new: true }
    );

    return asset ? deleteTrackedUploadAsset(asset, { now }) : false;
  }

  async function prepareMessageAttachmentsForDeletion({ messageId, ownerId }) {
    if (!UploadAsset) {
      return;
    }

    const normalizedMessageId = normalizeObjectId(messageId);
    const normalizedOwnerId = normalizeObjectId(ownerId);
    if (!normalizedMessageId || !normalizedOwnerId) {
      return;
    }

    await UploadAsset.updateMany(
      {
        message: normalizedMessageId,
        owner: normalizedOwnerId,
        status: { $in: ['claiming', 'attached'] },
      },
      {
        $set: { status: 'deleting', deletionStartedAt: new Date() },
        $unset: { claimStartedAt: '' },
      }
    );
  }

  async function restoreMessageAttachments({ messageId, ownerId }) {
    if (!UploadAsset) {
      return;
    }

    const normalizedMessageId = normalizeObjectId(messageId);
    const normalizedOwnerId = normalizeObjectId(ownerId);
    if (!normalizedMessageId || !normalizedOwnerId) {
      return;
    }

    await UploadAsset.updateMany(
      {
        message: normalizedMessageId,
        owner: normalizedOwnerId,
        status: 'deleting',
      },
      {
        $set: { status: 'attached', attachedAt: new Date() },
        $unset: { deletionStartedAt: '', pendingExpiresAt: '' },
      }
    );
  }

  async function deleteMessageAttachments({ messageId, ownerId }) {
    if (!UploadAsset) {
      return { deleted: 0, failed: 0 };
    }

    const normalizedMessageId = normalizeObjectId(messageId);
    const normalizedOwnerId = normalizeObjectId(ownerId);
    if (!normalizedMessageId || !normalizedOwnerId) {
      return { deleted: 0, failed: 0 };
    }

    const assets = await UploadAsset.find({
      message: normalizedMessageId,
      owner: normalizedOwnerId,
      status: 'deleting',
    }).limit(8);
    let deleted = 0;
    let failed = 0;

    for (const asset of assets) {
      try {
        if (await deleteTrackedUploadAsset(asset)) {
          deleted += 1;
        }
      } catch (error) {
        failed += 1;
        console.error('Message attachment cleanup failed:', error.message);
      }
    }

    return { deleted, failed };
  }

  async function cleanupAbandonedUploads({ now = new Date() } = {}) {
    if (!UploadAsset || !UploadQuota) {
      return { deleted: 0, failed: 0 };
    }

    const staleOperationCutoff = new Date(now.getTime() - 15 * 60 * 1000);
    const candidates = await UploadAsset.find({
      $or: [
        { status: 'pending', pendingExpiresAt: { $lte: now } },
        { status: 'uploading', createdAt: { $lte: staleOperationCutoff } },
        { status: 'claiming', claimStartedAt: { $lte: staleOperationCutoff } },
        { status: 'deleting', deletionStartedAt: { $lte: staleOperationCutoff } },
      ],
    })
      .sort({ pendingExpiresAt: 1 })
      .limit(MAX_PENDING_UPLOAD_CLEANUP_BATCH);
    let deleted = 0;
    let failed = 0;

    for (const candidate of candidates) {
      if (candidate.status === 'claiming') {
        try {
          const messageExists = await Message.exists({
            _id: candidate.message,
            sender: candidate.owner,
            'attachments.uploadId': candidate._id,
          });

          if (messageExists) {
            await UploadAsset.updateOne(
              { _id: candidate._id, status: 'claiming', message: candidate.message },
              {
                $set: { status: 'attached', attachedAt: now },
                $unset: { claimStartedAt: '', pendingExpiresAt: '' },
              }
            );
            continue;
          }
        } catch (error) {
          failed += 1;
          console.error('Attachment claim reconciliation failed:', error.message);
          continue;
        }
      }

      if (candidate.status === 'deleting' && candidate.message) {
        try {
          const messageExists = await Message.exists({ _id: candidate.message });
          if (messageExists) {
            await restoreMessageAttachments({
              messageId: candidate.message,
              ownerId: candidate.owner,
            });
            continue;
          }
        } catch (error) {
          failed += 1;
          console.error('Message deletion reconciliation failed:', error.message);
          continue;
        }
      }

      const asset = await UploadAsset.findOneAndUpdate(
        {
          _id: candidate._id,
          $or: [
            { status: 'pending', pendingExpiresAt: { $lte: now } },
            { status: 'uploading', createdAt: { $lte: staleOperationCutoff } },
            { status: 'claiming', claimStartedAt: { $lte: staleOperationCutoff } },
            { status: 'deleting', deletionStartedAt: { $lte: staleOperationCutoff } },
          ],
        },
        { $set: { status: 'deleting', deletionStartedAt: now } },
        { new: true }
      );

      if (!asset) {
        continue;
      }

      try {
        if (await deleteTrackedUploadAsset(asset, { now })) {
          deleted += 1;
        }
      } catch (error) {
        failed += 1;
        console.error('Pending upload cleanup failed:', error.message);
        await UploadAsset.updateOne(
          { _id: asset._id, status: 'deleting' },
          {
            $set: {
              deletionStartedAt: now,
            },
          }
        );
      }
    }

    return { deleted, failed };
  }

  return {
    buildPairKey,
    completeCloudinaryUpload,
    computeUnreadCount,
    claimPendingAttachments,
    cleanupAbandonedUploads,
    createCloudinaryUploadIntent,
    createOrReturnDirectChat,
    deleteMessageAttachments,
    discardUploadAsset,
    destroyCloudinaryAsset,
    emitStatusUpdates,
    escapeRegExp,
    fetchChatByIdForUser,
    fetchChatsForUser,
    fetchFriendOverview,
    finalizeMessageAttachments,
    findDirectChat,
    hasAcceptedFriendship,
    idList,
    isChatMember,
    markMessagesDelivered,
    markMessagesSeen,
    normalizeAttachment,
    prepareMessageAttachmentsForDeletion,
    recordPendingUpload,
    releaseMessageAttachments,
    releaseUploadQuota,
    reserveUploadQuota,
    restoreMessageAttachments,
    serializeChat,
    serializeFriendRequest,
    serializeMessage,
    serializeUser,
    serializeUserValue,
    syncChatLastMessage,
    uploadToCloudinary,
  };
}

module.exports = {
  createChatService,
};
