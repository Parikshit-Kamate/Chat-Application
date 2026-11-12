import { getDisplayUsername } from './displayNames';

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
