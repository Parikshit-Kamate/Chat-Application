import { useMemo } from 'react';
import { getChatName, getDisplayUsername, getOtherMember, getUserPresenceLabel } from '../messageUtils';

export function useChatView(context) {
  const {
    currentUser, friends, incomingRequests, outgoingRequests, chats, activeChatId, messages,
    sidebarSearch, friendSearchResults, typingUsers, messageContextMenu,
  } = context;

  const activeChat = useMemo(() => chats.find((chat) => chat.id === activeChatId) || null, [activeChatId, chats]);

  const filteredChats = useMemo(() => {
    const query = sidebarSearch.trim().toLowerCase();
    if (!query) {
      return chats;
    }

    return chats.filter((chat) => {
      const chatName = getChatName(chat, currentUser?.id).toLowerCase();
      return chatName.includes(query);
    });
  }, [chats, currentUser?.id, sidebarSearch]);

  const filteredFriendSearchResults = useMemo(() => {
    const excludedIds = new Set([
      ...friends.map((friend) => friend.id),
      ...incomingRequests.map((request) => request.user?.id).filter(Boolean),
      ...outgoingRequests.map((request) => request.user?.id).filter(Boolean),
    ]);

    return friendSearchResults.filter((user) => !excludedIds.has(user.id));
  }, [friendSearchResults, friends, incomingRequests, outgoingRequests]);

  const pendingFriendRequestCount = incomingRequests.length;

  const typingText = useMemo(() => {
    if (typingUsers.length === 0) {
      return '';
    }

    const getTypingUserName = (typingUser) => {
      const chatMember = (activeChat?.members || []).find((member) => member.id === typingUser.userId);
      return getDisplayUsername(chatMember || typingUser);
    };

    if (typingUsers.length === 1) {
      return `${getTypingUserName(typingUsers[0])} is typing...`;
    }

    return `${typingUsers.map(getTypingUserName).join(', ')} are typing...`;
  }, [activeChat?.members, typingUsers]);

  const shellClassName = 'message-shell';
  const activeChatMember = activeChat && currentUser ? getOtherMember(activeChat, currentUser.id) : null;
  const activeChatSubline = activeChat
    ? activeChat.type === 'group'
      ? `${activeChat.members?.length || 0} members`
      : getUserPresenceLabel(activeChatMember)
    : '';
  const contextMenuMessage = messageContextMenu ? messages.find((message) => message.id === messageContextMenu.messageId) || null : null;

  return {
    activeChat, filteredChats, filteredFriendSearchResults, pendingFriendRequestCount, typingText,
    shellClassName, activeChatSubline, contextMenuMessage,
  };
}
