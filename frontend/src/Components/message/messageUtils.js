export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export function formatRelativeTime(dateValue) {
  if (!dateValue) {
    return '';
  }

  const date = new Date(dateValue);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return 'just now';
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  return date.toLocaleDateString();
}

function normalizeDisplayPart(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function getDisplayUsername(userOrUsername, fallback = 'User') {
  if (userOrUsername && typeof userOrUsername === 'object') {
    const fullName = [normalizeDisplayPart(userOrUsername.firstName), normalizeDisplayPart(userOrUsername.lastName)]
      .filter(Boolean)
      .join(' ');

    if (fullName) {
      return fullName;
    }

    return getDisplayUsername(userOrUsername.username, fallback);
  }

  const normalizedUsername = normalizeDisplayPart(userOrUsername);

  if (!normalizedUsername) {
    return fallback;
  }

  const atIndex = normalizedUsername.indexOf('@');
  if (atIndex > 0) {
    return normalizedUsername.slice(0, atIndex);
  }

  return normalizedUsername;
}

function hashText(value) {
  return Array.from(String(value || 'user')).reduce((accumulator, character) => accumulator * 31 + character.charCodeAt(0), 7);
}

export function getAvatarInitials(username, fallback = 'U') {
  const label = getDisplayUsername(username, fallback).replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
  const parts = label.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return fallback.slice(0, 1).toUpperCase();
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function getAvatarPalette(username) {
  const palettes = [
    { start: '#ccfbf1', end: '#14b8a6', text: '#042f2e' },
    { start: '#dbeafe', end: '#3b82f6', text: '#172554' },
    { start: '#fde68a', end: '#f97316', text: '#431407' },
    { start: '#fce7f3', end: '#ec4899', text: '#500724' },
    { start: '#e0e7ff', end: '#6366f1', text: '#1e1b4b' },
    { start: '#dcfce7', end: '#22c55e', text: '#052e16' },
    { start: '#cffafe', end: '#06b6d4', text: '#083344' },
  ];
  const palette = palettes[Math.abs(hashText(getDisplayUsername(username, 'user'))) % palettes.length];

  return {
    '--avatar-start': palette.start,
    '--avatar-end': palette.end,
    '--avatar-text': palette.text,
  };
}

export function formatChatListTime(dateValue) {
  if (!dateValue) {
    return '';
  }

  const date = new Date(dateValue);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - targetDay.getTime()) / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  if (diffDays > 0 && diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  }

  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
  });
}

export function formatMessageMetaTime(dateValue) {
  if (!dateValue) {
    return '';
  }

  const date = new Date(dateValue);
  return date
    .toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })
    .toLowerCase();
}

export function getUserPresenceLabel(user) {
  if (!user) {
    return 'Last seen recently';
  }

  if (user.isOnline) {
    return 'Online';
  }

  return user.lastSeen ? `Last seen ${formatRelativeTime(user.lastSeen)}` : 'Last seen recently';
}

export function isImageAttachment(attachment) {
  if (!attachment) {
    return false;
  }

  if (attachment.resourceType === 'image') {
    return true;
  }

  const url = attachment.secureUrl || attachment.url || '';
  return url.startsWith('data:image/');
}

export function getCopyableMessageContent(message) {
  if (!message) {
    return '';
  }

  if (String(message.text || '').trim()) {
    return message.text.trim();
  }

  return (message.attachments || [])
    .map((attachment) => attachment?.secureUrl || attachment?.url || attachment?.fileName || '')
    .filter(Boolean)
    .join('\n');
}

export function getOtherMember(chat, myUserId) {
  if (!chat || chat.type !== 'direct') {
    return null;
  }

  return (chat.members || []).find((member) => member.id !== myUserId) || null;
}

export function getChatName(chat, myUserId) {
  if (!chat) {
    return '';
  }

  if (chat.type === 'group') {
    return chat.name || 'Untitled Group';
  }

  const otherMember = getOtherMember(chat, myUserId);
  return getDisplayUsername(otherMember, chat.name || 'Direct Chat');
}

export function getChatPreview(chat, myUserId) {
  const lastMessage = chat?.lastMessage;

  if (!lastMessage) {
    return chat?.type === 'group' ? `${chat.members?.length || 0} members` : 'Start a conversation';
  }

  const previewText = lastMessage.text || (lastMessage.attachments?.length ? 'Sent some media' : 'New activity');

  if (lastMessage.sender?.id === myUserId) {
    return `You: ${previewText}`;
  }

  if (chat?.type === 'group') {
    return `${getDisplayUsername(lastMessage.sender, 'Someone')}: ${previewText}`;
  }

  return previewText;
}

export function getMessageState(message, chat, myUserId) {
  const participantIds = (chat?.members || []).map((member) => member.id).filter((id) => id !== myUserId);

  if (participantIds.length === 0) {
    return { icon: 'bi-check2', text: 'Sent' };
  }

  const seenCount = participantIds.filter((id) => (message.seenBy || []).includes(id)).length;
  const deliveredCount = participantIds.filter((id) => (message.deliveredTo || []).includes(id)).length;

  if (seenCount === participantIds.length) {
    return { icon: 'bi-check2-all status-seen', text: 'Seen' };
  }

  if (seenCount > 0) {
    return { icon: 'bi-check2-all status-seen', text: `Seen ${seenCount}/${participantIds.length}` };
  }

  if (deliveredCount > 0) {
    return { icon: 'bi-check2-all', text: `Delivered ${deliveredCount}/${participantIds.length}` };
  }

  return { icon: 'bi-check2', text: 'Sent' };
}

export function getVisibleUnreadCount(chat, viewerId, activeChatId, isWindowVisible = true) {
  const unreadCount = Number(chat?.unreadCount || 0);

  if (!chat || unreadCount <= 0) {
    return 0;
  }

  if (chat.id === activeChatId && isWindowVisible) {
    return 0;
  }

  const lastMessage = chat.lastMessage;
  if (!lastMessage) {
    return unreadCount;
  }

  if (lastMessage.sender?.id === viewerId) {
    return 0;
  }

  if ((lastMessage.seenBy || []).includes(viewerId)) {
    return 0;
  }

  return unreadCount;
}
