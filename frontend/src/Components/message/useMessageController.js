import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import {
  createAttachmentReferences,
  MAX_FILES_PER_SELECTION,
  MAX_PENDING_ATTACHMENTS,
  uploadAttachmentBatch,
} from './attachmentUploads';
import { API_URL, SOCKET_URL, TOKEN_KEY } from './constants';
import {
  fileToDataUrl,
  getChatName,
  getCopyableMessageContent,
  getDisplayUsername,
  getOtherMember,
  getUserPresenceLabel,
  getVisibleUnreadCount,
} from './messageUtils';

const MESSAGE_PAGE_SIZE = 40;
const EMPTY_MESSAGE_PAGE_INFO = {
  hasMore: false,
  nextCursor: '',
};

function createClientMessageId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function getNextMessagePageInfo(pageInfo) {
  return {
    hasMore: Boolean(pageInfo?.hasMore),
    nextCursor: pageInfo?.nextCursor || '',
  };
}

export function useMessageController() {
  const api = useMemo(() => axios.create({ baseURL: `${API_URL}/api` }), []);

  const [token, setToken] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return localStorage.getItem(TOKEN_KEY) || '';
  });
  const [authMode, setAuthMode] = useState('login');
  const [authForm, setAuthForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    password: '',
  });
  const [authLoading, setAuthLoading] = useState(false);
  const [authInitializing, setAuthInitializing] = useState(() => Boolean(token));
  const [currentUser, setCurrentUser] = useState(null);

  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagePageInfo, setMessagePageInfo] = useState(EMPTY_MESSAGE_PAGE_INFO);
  const [hasLoadedInitialChats, setHasLoadedInitialChats] = useState(false);

  const [sidebarSearch, setSidebarSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalResults, setGlobalResults] = useState([]);
  const [highlightMessageId, setHighlightMessageId] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState([]);

  const [groupForm, setGroupForm] = useState({ name: '', memberIds: [] });
  const [groupBuilderOpen, setGroupBuilderOpen] = useState(false);

  const [messageText, setMessageText] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  const [isLoadingChats, setIsLoadingChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [friendActionKey, setFriendActionKey] = useState('');
  const [groupActionKey, setGroupActionKey] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [messageContextMenu, setMessageContextMenu] = useState(null);
  const [messageActionKey, setMessageActionKey] = useState('');

  const [toasts, setToasts] = useState([]);

  const socketRef = useRef(null);
  const activeChatIdRef = useRef(activeChatId);
  const currentUserRef = useRef(currentUser);
  const messageSearchRef = useRef(messageSearch);
  const messageScrollIntentRef = useRef('none');
  const latestMessagesRequestRef = useRef(0);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const messageScrollerRef = useRef(null);
  const pendingClientMessageIdRef = useRef('');
  const attachmentUploadActiveRef = useRef(false);
  const pendingAttachmentCountRef = useRef(pendingAttachments.length);

  useEffect(() => {
    pendingAttachmentCountRef.current = pendingAttachments.length;
  }, [pendingAttachments.length]);

  const authHeaders = useMemo(() => {
    if (!token) {
      return {};
    }

    return { Authorization: `Bearer ${token}` };
  }, [token]);

  const pushToast = useCallback((text, tone = 'info') => {
    const toastId = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id: toastId, text, tone }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
    }, 3200);
  }, []);

  const stopTyping = useCallback(() => {
    const chatId = activeChatIdRef.current;
    const socket = socketRef.current;

    if (!chatId || !socket || !isTypingRef.current) {
      return;
    }

    socket.emit('typing:stop', { chatId });
    isTypingRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!messageContextMenu) {
      return undefined;
    }

    const handleCloseMenu = () => {
      setMessageContextMenu(null);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMessageContextMenu(null);
      }
    };

    window.addEventListener('click', handleCloseMenu);
    window.addEventListener('scroll', handleCloseMenu, true);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('click', handleCloseMenu);
      window.removeEventListener('scroll', handleCloseMenu, true);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [messageContextMenu]);

  const loadUsers = useCallback(
    async (query = '') => {
      if (!token) {
        return;
      }

      try {
        const response = await api.get('/users', {
          headers: authHeaders,
          params: query ? { query } : undefined,
        });

        setUsers(response.data.users || []);
      } catch (error) {
        pushToast(error.response?.data?.error || 'Unable to load users.', 'danger');
      }
    },
    [api, authHeaders, pushToast, token]
  );

  const loadFriendsOverview = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setIsLoadingFriends(true);
      const response = await api.get('/friends', {
        headers: authHeaders,
      });

      setFriends(response.data.friends || []);
      setIncomingRequests(response.data.incomingRequests || []);
      setOutgoingRequests(response.data.outgoingRequests || []);
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to load friends.', 'danger');
    } finally {
      setIsLoadingFriends(false);
    }
  }, [api, authHeaders, pushToast, token]);

  const loadChats = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      setIsLoadingChats(true);
      const response = await api.get('/chats', {
        headers: authHeaders,
      });

      const nextChats = (response.data.chats || []).map((chat) => {
        const resolvedUnreadCount = getVisibleUnreadCount(
          chat,
          currentUserRef.current?.id,
          activeChatIdRef.current,
          typeof document === 'undefined' || document.visibilityState === 'visible'
        );

        if (resolvedUnreadCount === Number(chat.unreadCount || 0)) {
          return chat;
        }

        return {
          ...chat,
          unreadCount: resolvedUnreadCount,
        };
      });
      setChats(nextChats);

      setActiveChatId((prevChatId) => {
        if (prevChatId && nextChats.some((chat) => chat.id === prevChatId)) {
          return prevChatId;
        }

        return null;
      });
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to load chats.', 'danger');
    } finally {
      setIsLoadingChats(false);
      setHasLoadedInitialChats(true);
    }
  }, [api, authHeaders, pushToast, token]);

  const clearUnreadCountForChat = useCallback((chatId) => {
    if (!chatId) {
      return;
    }

    setChats((prevChats) =>
      prevChats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              unreadCount: 0,
            }
          : chat
      )
    );
  }, []);

  const markChatAsSeen = useCallback(
    async (chatId, { awaitRequest = false } = {}) => {
      if (!chatId || !token) {
        return;
      }

      clearUnreadCountForChat(chatId);
      socketRef.current?.emit('messages:mark_seen', { chatId });

      const request = api
        .post(
          `/chats/${chatId}/read`,
          {},
          {
            headers: authHeaders,
          }
        )
        .catch(() => {});

      if (awaitRequest) {
        await request;
      }
    },
    [api, authHeaders, clearUnreadCountForChat, token]
  );

  const loadMessages = useCallback(
    async (chatId, query = '') => {
      if (!chatId || !token) {
        return;
      }

      const requestId = latestMessagesRequestRef.current + 1;
      const normalizedQuery = String(query || '').trim();
      latestMessagesRequestRef.current = requestId;

      try {
        setIsLoadingMessages(true);
        setIsLoadingOlderMessages(false);
        setMessagePageInfo(EMPTY_MESSAGE_PAGE_INFO);
        messageScrollIntentRef.current = 'bottom';

        const response = await api.get(`/chats/${chatId}/messages`, {
          headers: authHeaders,
          params: {
            limit: MESSAGE_PAGE_SIZE,
            ...(normalizedQuery ? { query: normalizedQuery } : {}),
          },
        });

        if (latestMessagesRequestRef.current !== requestId || activeChatIdRef.current !== chatId) {
          return;
        }

        setMessages(response.data.messages || []);
        setMessagePageInfo(getNextMessagePageInfo(response.data.pageInfo));

        if (!normalizedQuery) {
          await markChatAsSeen(chatId, { awaitRequest: true });
        }
      } catch (error) {
        if (latestMessagesRequestRef.current === requestId) {
          pushToast(error.response?.data?.error || 'Unable to load messages.', 'danger');
        }
      } finally {
        if (latestMessagesRequestRef.current === requestId) {
          setIsLoadingMessages(false);
        }
      }
    },
    [api, authHeaders, markChatAsSeen, pushToast, token]
  );

  const loadOlderMessages = useCallback(async () => {
    const chatId = activeChatIdRef.current;
    const query = messageSearchRef.current.trim();
    const cursor = messagePageInfo.nextCursor;

    if (!chatId || !token || !messagePageInfo.hasMore || !cursor || isLoadingMessages || isLoadingOlderMessages) {
      return;
    }

    try {
      setIsLoadingOlderMessages(true);
      messageScrollIntentRef.current = 'preserve';

      const response = await api.get(`/chats/${chatId}/messages`, {
        headers: authHeaders,
        params: {
          limit: MESSAGE_PAGE_SIZE,
          cursor,
          ...(query ? { query } : {}),
        },
      });

      if (activeChatIdRef.current !== chatId || messageSearchRef.current.trim() !== query) {
        return;
      }

      const olderMessages = response.data.messages || [];
      setMessages((prevMessages) => {
        const existingIds = new Set(prevMessages.map((message) => message.id));
        const uniqueOlderMessages = olderMessages.filter((message) => message?.id && !existingIds.has(message.id));

        if (uniqueOlderMessages.length === 0) {
          return prevMessages;
        }

        return [...uniqueOlderMessages, ...prevMessages];
      });
      setMessagePageInfo(getNextMessagePageInfo(response.data.pageInfo));
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to load older messages.', 'danger');
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }, [
    api,
    authHeaders,
    isLoadingMessages,
    isLoadingOlderMessages,
    messagePageInfo.hasMore,
    messagePageInfo.nextCursor,
    pushToast,
    token,
  ]);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
    pendingClientMessageIdRef.current = '';
  }, [activeChatId]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    messageSearchRef.current = messageSearch;
  }, [messageSearch]);

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setAuthInitializing(false);
      setHasLoadedInitialChats(false);
      setCurrentUser(null);
      setChats([]);
      setMessages([]);
      setMessagePageInfo(EMPTY_MESSAGE_PAGE_INFO);
      setIsLoadingOlderMessages(false);
      setUsers([]);
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setFriendSearch('');
      setFriendSearchResults([]);
      return;
    }

    let cancelled = false;

    const loadMe = async () => {
      const isRestoringSavedSession = !currentUserRef.current;

      if (isRestoringSavedSession) {
        setAuthInitializing(true);
      }

      try {
        const response = await api.get('/auth/me', {
          headers: authHeaders,
        });

        if (!cancelled) {
          setCurrentUser(response.data.user);
        }
      } catch (error) {
        if (!cancelled) {
          setToken('');
          setHasLoadedInitialChats(false);
          setCurrentUser(null);
          pushToast('Session expired. Please sign in again.', 'danger');
        }
      } finally {
        if (!cancelled) {
          setAuthInitializing(false);
        }
      }
    };

    loadMe();

    return () => {
      cancelled = true;
    };
  }, [api, authHeaders, pushToast, token]);

  useEffect(() => {
    if (!currentUser || !token) {
      return;
    }

    loadUsers();
    loadFriendsOverview();
    loadChats();
  }, [currentUser, loadChats, loadFriendsOverview, loadUsers, token]);

  useEffect(() => {
    if (!token) {
      setFriendSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    const query = friendSearch.trim();
    if (query.length < 2) {
      setFriendSearchResults([]);
      setIsSearchingUsers(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setIsSearchingUsers(true);
        const response = await api.get('/users', {
          headers: authHeaders,
          params: { query },
        });

        setFriendSearchResults(response.data.users || []);
      } catch (error) {
        pushToast(error.response?.data?.error || 'Unable to search users.', 'danger');
      } finally {
        setIsSearchingUsers(false);
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [api, authHeaders, friendSearch, pushToast, token]);

  useEffect(() => {
    if (!currentUser || !token) {
      return;
    }

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      withCredentials: true,
    });

    socketRef.current = socket;

    const handleConnect = () => {
      loadChats();
      loadFriendsOverview();
    };

    const handleConnectError = (error) => {
      pushToast(error.message || 'Socket connection failed.', 'danger');
    };

    const handleMessageStatus = (status) => {
      const seenByCurrentUser = Boolean(currentUser?.id && (status.seenBy || []).includes(currentUser.id));

      if (seenByCurrentUser) {
        clearUnreadCountForChat(status.chatId);
      }

      setMessages((prevMessages) =>
        prevMessages.map((message) =>
          message.id === status.messageId
            ? {
                ...message,
                deliveredTo: status.deliveredTo || [],
                seenBy: status.seenBy || [],
              }
            : message
        )
      );

      setChats((prevChats) =>
        prevChats.map((chat) => {
          if (chat.id !== status.chatId) {
            return chat;
          }

          if (!chat.lastMessage || chat.lastMessage.id !== status.messageId) {
            return chat;
          }

          return {
            ...chat,
            lastMessage: {
              ...chat.lastMessage,
              deliveredTo: status.deliveredTo || [],
              seenBy: status.seenBy || [],
            },
          };
        })
      );
    };

    const handlePresenceUpdate = (presence) => {
      const { userId, isOnline, lastSeen } = presence;
      const syncPresence = (user) =>
        user.id === userId
          ? {
              ...user,
              isOnline,
              lastSeen,
            }
          : user;
      const syncRequestPresence = (request) => ({
        ...request,
        user: request.user?.id === userId ? syncPresence(request.user) : request.user,
        requester: request.requester?.id === userId ? syncPresence(request.requester) : request.requester,
        recipient: request.recipient?.id === userId ? syncPresence(request.recipient) : request.recipient,
      });

      setUsers((prevUsers) => prevUsers.map(syncPresence));
      setFriendSearchResults((prevUsers) => prevUsers.map(syncPresence));
      setFriends((prevFriends) => prevFriends.map(syncPresence));
      setIncomingRequests((prevRequests) => prevRequests.map(syncRequestPresence));
      setOutgoingRequests((prevRequests) => prevRequests.map(syncRequestPresence));

      setChats((prevChats) =>
        prevChats.map((chat) => ({
          ...chat,
          members: (chat.members || []).map((member) =>
            member.id === userId
              ? {
                  ...member,
                  isOnline,
                  lastSeen,
                }
              : member
          ),
        }))
      );
    };

    const handleTypingUpdate = (payload) => {
      if (!payload || payload.chatId !== activeChatIdRef.current) {
        return;
      }

      if (payload.userId === currentUserRef.current?.id) {
        return;
      }

      setTypingUsers((prevTyping) => {
        const exists = prevTyping.some((user) => user.userId === payload.userId);

        if (payload.isTyping && !exists) {
          return [...prevTyping, { userId: payload.userId, username: payload.username }];
        }

        if (!payload.isTyping && exists) {
          return prevTyping.filter((user) => user.userId !== payload.userId);
        }

        return prevTyping;
      });
    };

    const triggerBrowserNotification = (payload) => {
      if (!payload?.message || payload.message.sender?.id === currentUserRef.current?.id) {
        return;
      }

      if (!('Notification' in window)) {
        return;
      }

      if (Notification.permission === 'granted') {
        new Notification('New Confabulate message', {
          body: 'Open the app to view your message.',
        });
      }
    };

    const handleIncomingNotification = (payload) => {
      if (!payload?.message || payload.message.sender?.id === currentUserRef.current?.id) {
        return;
      }

      const sender = getDisplayUsername(payload.message.sender, 'Someone');
      const messagePreview = payload.message.text || 'Sent an attachment';
      pushToast(`${sender}: ${messagePreview}`, 'info');
      triggerBrowserNotification(payload);
    };

    const handleMessageNew = (incomingMessage) => {
      if (!incomingMessage?.id || !incomingMessage.chatId) {
        return;
      }

      const chatIsActive = incomingMessage.chatId === activeChatIdRef.current;
      const isOwnMessage = incomingMessage.sender?.id === currentUserRef.current?.id;

      setChats((prevChats) => {
        const existingChat = prevChats.find((chat) => chat.id === incomingMessage.chatId);

        if (!existingChat) {
          loadChats();
          return prevChats;
        }

        return prevChats
          .map((chat) => {
            if (chat.id !== incomingMessage.chatId) {
              return chat;
            }

            const unreadDelta = chatIsActive || isOwnMessage ? 0 : 1;
            return {
              ...chat,
              unreadCount: (chat.unreadCount || 0) + unreadDelta,
              lastMessage: incomingMessage,
              updatedAt: incomingMessage.createdAt || chat.updatedAt,
            };
          })
          .sort((leftChat, rightChat) => new Date(rightChat.updatedAt) - new Date(leftChat.updatedAt));
      });

      if (chatIsActive) {
        messageScrollIntentRef.current = 'bottom';
        setMessages((prevMessages) => {
          if (prevMessages.some((message) => message.id === incomingMessage.id)) {
            return prevMessages;
          }

          return [...prevMessages, incomingMessage];
        });

        if (!isOwnMessage) {
          if (document.visibilityState === 'visible') {
            markChatAsSeen(incomingMessage.chatId);
          } else {
            socket.emit('message:delivered', {
              chatId: incomingMessage.chatId,
              messageId: incomingMessage.id,
            });
          }
        }
      } else if (!isOwnMessage) {
        handleIncomingNotification({ chatId: incomingMessage.chatId, message: incomingMessage });
      }
    };

    const handleMessageDeleted = (payload) => {
      if (!payload?.messageId || !payload.chatId) {
        return;
      }

      setMessages((prevMessages) =>
        prevMessages
          .filter((message) => message.id !== payload.messageId)
          .map((message) =>
            message.replyTo?.id === payload.messageId
              ? {
                  ...message,
                  replyTo: null,
                }
              : message
          )
      );

      setReplyTarget((prevReplyTarget) => (prevReplyTarget?.id === payload.messageId ? null : prevReplyTarget));
      setHighlightMessageId((prevHighlightMessageId) => (prevHighlightMessageId === payload.messageId ? '' : prevHighlightMessageId));

      setMessageContextMenu((prevMenu) => (prevMenu?.messageId === payload.messageId ? null : prevMenu));
    };

    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('chat:list:refresh', loadChats);
    socket.on('friends:refresh', loadFriendsOverview);
    socket.on('presence:update', handlePresenceUpdate);
    socket.on('typing:update', handleTypingUpdate);
    socket.on('message:status', handleMessageStatus);
    socket.on('message:deleted', handleMessageDeleted);
    socket.on('notification:new_message', handleIncomingNotification);
    socket.on('message:new', handleMessageNew);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('chat:list:refresh', loadChats);
      socket.off('friends:refresh', loadFriendsOverview);
      socket.off('presence:update', handlePresenceUpdate);
      socket.off('typing:update', handleTypingUpdate);
      socket.off('message:status', handleMessageStatus);
      socket.off('message:deleted', handleMessageDeleted);
      socket.off('notification:new_message', handleIncomingNotification);
      socket.off('message:new', handleMessageNew);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [clearUnreadCountForChat, currentUser, loadChats, loadFriendsOverview, markChatAsSeen, pushToast, token]);

  useEffect(() => {
    if (!activeChatId || !token) {
      setMessages([]);
      setMessagePageInfo(EMPTY_MESSAGE_PAGE_INFO);
      setIsLoadingOlderMessages(false);
      setTypingUsers([]);
      return;
    }

    setMessages([]);
    setMessagePageInfo(EMPTY_MESSAGE_PAGE_INFO);
    setIsLoadingOlderMessages(false);
    socketRef.current?.emit('chat:open', { chatId: activeChatId });
    markChatAsSeen(activeChatId);

    return () => {
      socketRef.current?.emit('chat:close', { chatId: activeChatId });
      stopTyping();
      setTypingUsers([]);
    };
  }, [activeChatId, markChatAsSeen, stopTyping, token]);

  useEffect(() => {
    if (!activeChatId || !token) {
      return;
    }

    const timer = window.setTimeout(() => {
      loadMessages(activeChatId, messageSearch.trim());
    }, 180);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeChatId, loadMessages, messageSearch, token]);

  useEffect(() => {
    if (!highlightMessageId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setHighlightMessageId('');
    }, 2600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [highlightMessageId]);

  useEffect(() => {
    if (highlightMessageId) {
      const highlightedElement = document.getElementById(`msg-${highlightMessageId}`);
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageScrollIntentRef.current = 'none';
        return;
      }
    }

    if (messageScrollIntentRef.current === 'bottom' && messageScrollerRef.current) {
      messageScrollerRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    messageScrollIntentRef.current = 'none';
  }, [messages, highlightMessageId]);

  useEffect(() => {
    if (!globalSearch.trim() || globalSearch.trim().length < 2 || !token) {
      setGlobalResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const response = await api.get('/search/messages', {
          headers: authHeaders,
          params: {
            query: globalSearch.trim(),
          },
        });

        setGlobalResults(response.data.results || []);
      } catch (error) {
        pushToast(error.response?.data?.error || 'Unable to run search.', 'danger');
      }
    }, 220);

    return () => {
      window.clearTimeout(timer);
    };
  }, [api, authHeaders, globalSearch, pushToast, token]);

  useEffect(() => {
    const handleVisibility = () => {
      if (!socketRef.current || !activeChatIdRef.current || document.visibilityState !== 'visible') {
        return;
      }

      markChatAsSeen(activeChatIdRef.current);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [markChatAsSeen]);

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

  const handleAuthSubmit = async (event) => {
    event.preventDefault();

    if (!authForm.username.trim() || !authForm.password) {
      pushToast('Username and password are required.', 'warning');
      return;
    }

    const trimmedFirstName = String(authForm.firstName || '').trim();
    const trimmedLastName = String(authForm.lastName || '').trim();

    if (authMode === 'register' && (!trimmedFirstName || !trimmedLastName)) {
      pushToast('First name and last name are required.', 'warning');
      return;
    }

    try {
      setAuthLoading(true);
      setHasLoadedInitialChats(false);
      const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
      const requestBody = {
        username: authForm.username.trim(),
        password: authForm.password,
      };

      if (authMode === 'register') {
        requestBody.firstName = trimmedFirstName;
        requestBody.lastName = trimmedLastName;
      }

      const response = await api.post(endpoint, requestBody);

      setToken(response.data.token);
      setCurrentUser(response.data.user);
      setAuthForm({
        firstName: authMode === 'register' ? trimmedFirstName : '',
        lastName: authMode === 'register' ? trimmedLastName : '',
        username: authForm.username.trim(),
        password: '',
      });
      pushToast(authMode === 'login' ? 'Signed in.' : 'Account created.', 'success');
    } catch (error) {
      pushToast(
        error.response?.data?.error || 'Cannot reach the backend. Make sure the API is running on port 8000 and CORS allows port 5173.',
        'danger'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    socketRef.current?.disconnect();
    socketRef.current = null;

    setAuthInitializing(false);
    setHasLoadedInitialChats(false);
    setToken('');
    setCurrentUser(null);
    setChats([]);
    setMessages([]);
    setMessagePageInfo(EMPTY_MESSAGE_PAGE_INFO);
    setIsLoadingOlderMessages(false);
    setUsers([]);
    setFriends([]);
    setIncomingRequests([]);
    setOutgoingRequests([]);
    setActiveChatId(null);
    setTypingUsers([]);
    setPendingAttachments([]);
    setReplyTarget(null);
    setGlobalResults([]);
    setGlobalSearch('');
    setFriendSearch('');
    setFriendSearchResults([]);
    setFriendActionKey('');
    setGroupActionKey('');
    setGroupBuilderOpen(false);
    setIsSettingsOpen(false);
    setShowEmojiPicker(false);
  };

  const handleSendFriendRequest = async (recipientUserId) => {
    if (!recipientUserId) {
      return;
    }

    try {
      setFriendActionKey(`send-${recipientUserId}`);
      await api.post(
        '/friends/requests',
        {
          recipientUserId,
        },
        {
          headers: authHeaders,
        }
      );

      await loadFriendsOverview();
      pushToast('Friend request sent.', 'success');
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to send friend request.', 'danger');
    } finally {
      setFriendActionKey('');
    }
  };

  const handleAcceptFriendRequest = async (requestId) => {
    if (!requestId) {
      return;
    }

    try {
      setFriendActionKey(`accept-${requestId}`);
      await api.post(
        `/friends/requests/${requestId}/accept`,
        {},
        {
          headers: authHeaders,
        }
      );

      await Promise.all([loadFriendsOverview(), loadChats()]);
      pushToast('Friend request accepted.', 'success');
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to accept friend request.', 'danger');
    } finally {
      setFriendActionKey('');
    }
  };

  const handleRejectFriendRequest = async (requestId) => {
    if (!requestId) {
      return;
    }

    try {
      setFriendActionKey(`reject-${requestId}`);
      await api.post(
        `/friends/requests/${requestId}/reject`,
        {},
        {
          headers: authHeaders,
        }
      );

      await loadFriendsOverview();
      pushToast('Friend request rejected.', 'info');
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to reject friend request.', 'danger');
    } finally {
      setFriendActionKey('');
    }
  };

  const toggleGroupMember = (userId) => {
    setGroupForm((prevForm) => {
      const alreadySelected = prevForm.memberIds.includes(userId);

      if (alreadySelected) {
        return {
          ...prevForm,
          memberIds: prevForm.memberIds.filter((memberId) => memberId !== userId),
        };
      }

      return {
        ...prevForm,
        memberIds: [...prevForm.memberIds, userId],
      };
    });
  };

  const handleCreateGroupChat = async () => {
    try {
      const response = await api.post(
        '/chats/group',
        {
          name: groupForm.name.trim(),
          participantIds: groupForm.memberIds,
        },
        {
          headers: authHeaders,
        }
      );

      await loadChats();
      if (response.data.chat?.id) {
        setActiveChatId(response.data.chat.id);
      }

      setGroupBuilderOpen(false);
      setGroupForm({ name: '', memberIds: [] });
      setIsSettingsOpen(false);
      pushToast('Group chat created.', 'success');
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to create group chat.', 'danger');
    }
  };

  const handleRenameGroupChat = async (chatId, name) => {
    const nextName = String(name || '').trim();

    if (!chatId || !nextName) {
      pushToast('Group name is required.', 'warning');
      return;
    }

    try {
      setGroupActionKey(`rename-${chatId}`);
      const response = await api.patch(
        `/chats/${chatId}`,
        {
          name: nextName,
        },
        {
          headers: authHeaders,
        }
      );

      await loadChats();
      if (response.data.chat?.id) {
        setActiveChatId(response.data.chat.id);
      }
      pushToast('Group name updated.', 'success');
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to update group.', 'danger');
    } finally {
      setGroupActionKey('');
    }
  };

  const handleAddGroupMembers = async (chatId, memberIds) => {
    const selectedMemberIds = Array.isArray(memberIds) ? memberIds.filter(Boolean) : [];

    if (!chatId || selectedMemberIds.length === 0) {
      pushToast('Select at least one member to add.', 'warning');
      return;
    }

    try {
      setGroupActionKey(`add-${chatId}`);
      const response = await api.post(
        `/chats/${chatId}/members`,
        {
          memberIds: selectedMemberIds,
        },
        {
          headers: authHeaders,
        }
      );

      await loadChats();
      if (response.data.chat?.id) {
        setActiveChatId(response.data.chat.id);
      }
      pushToast('Group members added.', 'success');
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to add group members.', 'danger');
    } finally {
      setGroupActionKey('');
    }
  };

  const handleRemoveGroupMember = async (chatId, memberId) => {
    if (!chatId || !memberId) {
      return;
    }

    try {
      setGroupActionKey(`remove-${memberId}`);
      const response = await api.delete(`/chats/${chatId}/members/${memberId}`, {
        headers: authHeaders,
      });

      await loadChats();

      if (response.data.chat?.id) {
        setActiveChatId(response.data.chat.id);
      } else if (activeChatIdRef.current === chatId) {
        setActiveChatId(null);
      }

      pushToast(memberId === currentUserRef.current?.id ? 'You left the group.' : 'Group member removed.', 'success');
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to update group members.', 'danger');
    } finally {
      setGroupActionKey('');
    }
  };

  const handleLeaveGroupChat = async (chatId) => {
    await handleRemoveGroupMember(chatId, currentUserRef.current?.id);
  };

  const handleStartTyping = () => {
    const socket = socketRef.current;
    const chatId = activeChatIdRef.current;

    if (!socket || !chatId) {
      return;
    }

    if (!isTypingRef.current) {
      socket.emit('typing:start', { chatId });
      isTypingRef.current = true;
    }

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = window.setTimeout(() => {
      stopTyping();
    }, 1200);
  };

  const handleMessageInput = (event) => {
    setMessageText(event.target.value);
    handleStartTyping();
  };

  const handleSendMessage = () => {
    const socket = socketRef.current;
    const chatId = activeChatIdRef.current;

    if (!socket || !chatId) {
      return;
    }

    if (attachmentUploadActiveRef.current) {
      pushToast('Wait for the selected attachments to finish uploading.', 'warning');
      return;
    }

    const trimmedText = messageText.trim();
    if (!trimmedText && pendingAttachments.length === 0) {
      return;
    }

    const payload = {
      chatId,
      clientMessageId: pendingClientMessageIdRef.current || createClientMessageId(),
      text: trimmedText,
      replyToId: replyTarget?.id || null,
      attachments: createAttachmentReferences(pendingAttachments),
    };
    pendingClientMessageIdRef.current = payload.clientMessageId;

    socket.emit('message:send', payload, (response) => {
      if (response?.error) {
        if (response.code === 'CLIENT_MESSAGE_ID_CONFLICT') {
          pendingClientMessageIdRef.current = '';
        }
        pushToast(response.error, 'danger');
        return;
      }

      setMessageText('');
      setPendingAttachments([]);
      setReplyTarget(null);
      setShowEmojiPicker(false);
      pendingClientMessageIdRef.current = '';
      stopTyping();
    });
  };

  const handleComposerKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileSelection = async (event) => {
    const fileInput = event.currentTarget || event.target;
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) {
      return;
    }

    if (attachmentUploadActiveRef.current) {
      pushToast('Another attachment upload is already in progress.', 'warning');
      fileInput.value = '';
      return;
    }

    const availableSlots = Math.max(0, MAX_PENDING_ATTACHMENTS - pendingAttachmentCountRef.current);

    if (availableSlots === 0) {
      pushToast(`You can attach up to ${MAX_PENDING_ATTACHMENTS} files.`, 'warning');
      fileInput.value = '';
      return;
    }

    if (selectedFiles.length > MAX_FILES_PER_SELECTION) {
      pushToast(`Only the first ${MAX_FILES_PER_SELECTION} selected files will be considered.`, 'warning');
    }

    if (selectedFiles.length > availableSlots) {
      pushToast(
        `Only ${availableSlots} more attachment${availableSlots === 1 ? '' : 's'} can be added.`,
        'warning'
      );
    }

    try {
      attachmentUploadActiveRef.current = true;
      setUploading(true);

      await uploadAttachmentBatch({
        files: selectedFiles,
        availableSlots,
        uploadFile: async (file) => {
          const dataUrl = await fileToDataUrl(file);
          const response = await api.post(
            '/uploads',
            {
              fileName: file.name,
              dataUrl,
              contentType: file.type,
              size: file.size,
            },
            {
              headers: authHeaders,
            }
          );

          return response.data;
        },
        onUploaded: (attachment, uploadResponse) => {
          pendingAttachmentCountRef.current += 1;
          setPendingAttachments((prevAttachments) => [...prevAttachments, attachment]);

          if (uploadResponse?.fallback) {
            pushToast('Cloudinary not configured, file attached as temporary data URL.', 'warning');
          }
        },
        onRejected: (error, file) => {
          const message = error.response?.data?.error || error.message || 'File upload failed.';
          pushToast(`${file?.name || 'Attachment'}: ${message}`, 'danger');
        },
        onOversized: (file) => {
          pushToast(`${file?.name || 'Attachment'} is too large (max 10MB).`, 'warning');
        },
      });
    } finally {
      attachmentUploadActiveRef.current = false;
      setUploading(false);
      fileInput.value = '';
    }
  };

  const handleOpenMessageContextMenu = (event, message, canDelete) => {
    event.preventDefault();

    const menuWidth = 172;
    const menuHeight = canDelete ? 108 : 60;
    const viewportWidth = window.innerWidth || 0;
    const viewportHeight = window.innerHeight || 0;
    const x = Math.max(12, Math.min(event.clientX, viewportWidth - menuWidth - 12));
    const y = Math.max(12, Math.min(event.clientY, viewportHeight - menuHeight - 12));

    setMessageContextMenu({
      messageId: message.id,
      x,
      y,
      canDelete,
    });
  };

  const copyTextToClipboard = useCallback(async (text) => {
    if (!text) {
      throw new Error('Nothing to copy.');
    }

    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const helper = document.createElement('textarea');
    helper.value = text;
    helper.setAttribute('readonly', '');
    helper.style.position = 'fixed';
    helper.style.opacity = '0';
    document.body.appendChild(helper);
    helper.select();
    document.execCommand('copy');
    document.body.removeChild(helper);
  }, []);

  const handleCopyMessage = useCallback(
    async (message) => {
      try {
        const value = getCopyableMessageContent(message);
        await copyTextToClipboard(value);
        pushToast('Message copied.', 'success');
      } catch (error) {
        pushToast(error.message || 'Unable to copy message.', 'danger');
      } finally {
        setMessageContextMenu(null);
      }
    },
    [copyTextToClipboard, pushToast]
  );

  const handleDeleteMessage = useCallback(
    async (message) => {
      if (!message?.id) {
        return;
      }

      try {
        setMessageActionKey(`delete-${message.id}`);
        await api.delete(`/messages/${message.id}`, {
          headers: authHeaders,
        });

        pushToast('Message deleted.', 'success');
      } catch (error) {
        pushToast(error.response?.data?.error || 'Unable to delete message.', 'danger');
      } finally {
        setMessageActionKey('');
        setMessageContextMenu(null);
      }
    },
    [api, authHeaders, pushToast]
  );

  const handleOpenSearchResult = (result) => {
    if (!result?.chatId) {
      return;
    }

    setActiveChatId(result.chatId);
    setMessageSearch('');
    setHighlightMessageId(result.id || '');
    setGlobalResults([]);
    setGlobalSearch('');
    setIsSettingsOpen(false);
  };

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
    activeChat,
    activeChatId,
    activeChatSubline,
    authForm,
    authInitializing,
    authLoading,
    authMode,
    contextMenuMessage,
    currentUser,
    filteredChats,
    filteredFriendSearchResults,
    friends,
    friendActionKey,
    friendSearch,
    globalResults,
    globalSearch,
    groupActionKey,
    groupBuilderOpen,
    groupForm,
    handleAcceptFriendRequest,
    handleAddGroupMembers,
    handleAuthSubmit,
    handleComposerKeyDown,
    handleCopyMessage,
    handleCreateGroupChat,
    handleDeleteMessage,
    handleFileSelection,
    handleLeaveGroupChat,
    handleLogout,
    handleMessageInput,
    handleLoadOlderMessages: loadOlderMessages,
    handleOpenMessageContextMenu,
    handleOpenSearchResult,
    handleRejectFriendRequest,
    handleRemoveGroupMember,
    handleRenameGroupChat,
    handleSendFriendRequest,
    handleSendMessage,
    highlightMessageId,
    incomingRequests,
    isLoadingChats,
    isChatListInitializing: Boolean(currentUser && !hasLoadedInitialChats),
    isLoadingFriends,
    isLoadingMessages,
    isLoadingOlderMessages,
    isSearchingUsers,
    isSettingsOpen,
    messageActionKey,
    messageContextMenu,
    messageScrollerRef,
    messageSearch,
    messageText,
    messages,
    hasMoreMessages: messagePageInfo.hasMore,
    pendingAttachments,
    pendingFriendRequestCount,
    replyTarget,
    setActiveChatId,
    setAuthForm,
    setAuthMode,
    setFriendSearch,
    setGlobalSearch,
    setGroupBuilderOpen,
    setGroupForm,
    setHighlightMessageId,
    setIsSettingsOpen,
    setMessageSearch,
    setMessageText,
    setPendingAttachments,
    setReplyTarget,
    setShowEmojiPicker,
    setSidebarSearch,
    shellClassName,
    showEmojiPicker,
    sidebarSearch,
    toasts,
    toggleGroupMember,
    typingText,
    uploading,
    users,
  };
}
