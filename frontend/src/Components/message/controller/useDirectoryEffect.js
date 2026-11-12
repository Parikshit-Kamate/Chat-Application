import { useEffect } from 'react';

export function useDirectoryEffect(context) {
  const {
    token, currentUser, loadUsers, loadFriendsOverview, loadChats,
  } = context;

  useEffect(() => {
    if (!currentUser || !token) {
      return;
    }

    loadUsers();
    loadFriendsOverview();
    loadChats();
  }, [currentUser, loadChats, loadFriendsOverview, loadUsers, token]);
}
