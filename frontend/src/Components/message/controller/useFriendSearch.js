import { useEffect } from 'react';

export function useFriendSearch(context) {
  const {
    api, token, friendSearch, setFriendSearchResults, setIsSearchingUsers, authHeaders, pushToast,
  } = context;

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
}
