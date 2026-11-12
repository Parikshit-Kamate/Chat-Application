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
