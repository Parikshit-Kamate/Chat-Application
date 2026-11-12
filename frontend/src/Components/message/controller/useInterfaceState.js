import { useState } from 'react';

export function useInterfaceState() {
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

  return {
    isLoadingChats, setIsLoadingChats, isLoadingMessages, setIsLoadingMessages,
    isLoadingOlderMessages, setIsLoadingOlderMessages, isLoadingFriends, setIsLoadingFriends,
    isSearchingUsers, setIsSearchingUsers, friendActionKey, setFriendActionKey, groupActionKey,
    setGroupActionKey, isSettingsOpen, setIsSettingsOpen, messageContextMenu,
    setMessageContextMenu, messageActionKey, setMessageActionKey, toasts, setToasts,
  };
}
