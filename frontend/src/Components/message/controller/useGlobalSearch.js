import { useEffect } from 'react';

export function useGlobalSearch(context) {
  const {
    api, token, globalSearch, setGlobalResults, authHeaders, pushToast,
  } = context;

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
}
