import { useEffect, useRef, useState } from 'react';

export default function useChatPanelState({
  activeChat, messages, messageSearch = '', setMessageSearch,
  hasMoreMessages = false, isLoadingMessages, isLoadingOlderMessages = false,
  handleLoadOlderMessages = () => {},
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const messageListRef = useRef(null);
  const pendingScrollHeightRef = useRef(null);
  const searchInputRef = useRef(null);
  const trimmedMessageSearch = messageSearch.trim();

  const requestOlderMessages = () => {
    if (!hasMoreMessages || isLoadingMessages || isLoadingOlderMessages || pendingScrollHeightRef.current !== null) {
      return;
    }

    pendingScrollHeightRef.current = messageListRef.current?.scrollHeight || 0;
    handleLoadOlderMessages();
  };

  const handleMessagesScroll = () => {
    const messageList = messageListRef.current;

    if (!messageList || messageList.scrollTop > 96) {
      return;
    }

    requestOlderMessages();
  };

  useEffect(() => {
    if (trimmedMessageSearch) {
      setIsSearchOpen(true);
    }
  }, [trimmedMessageSearch]);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (isLoadingOlderMessages || pendingScrollHeightRef.current === null) {
      return;
    }

    const messageList = messageListRef.current;
    if (messageList) {
      messageList.scrollTop += messageList.scrollHeight - pendingScrollHeightRef.current;
    }

    pendingScrollHeightRef.current = null;
  }, [isLoadingOlderMessages, messages.length]);

  useEffect(() => {
    pendingScrollHeightRef.current = null;
  }, [activeChat?.id, trimmedMessageSearch]);

  const handleCloseSearch = () => {
    setMessageSearch('');
    setIsSearchOpen(false);
  };

  return {
    isSearchOpen, setIsSearchOpen, searchInputRef, handleCloseSearch,
    messageListRef, handleMessagesScroll, requestOlderMessages, trimmedMessageSearch,
  };
}
