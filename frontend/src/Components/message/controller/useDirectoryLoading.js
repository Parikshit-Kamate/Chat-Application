import { useCallback } from 'react';

export function useDirectoryLoading(context) {
  const {
    api, token, setUsers, setFriends, setIncomingRequests, setOutgoingRequests,
    setIsLoadingFriends, authHeaders, pushToast,
  } = context;

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

  return {
    loadUsers, loadFriendsOverview,
  };
}
