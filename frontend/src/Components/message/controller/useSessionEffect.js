import { useEffect } from 'react';
import { TOKEN_KEY } from '../constants';

export function useSessionEffect(context) {
  const {
    api, token, setAuthInitializing, setCurrentUser, currentUserRef, authHeaders, endSession, session,
  } = context;

  useEffect(() => {
    if (!session.isCurrent()) return;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }, [session, token]);

  useEffect(() => {
    if (!token) {
      setAuthInitializing(false);
      return;
    }
    let cancelled = false;
    const loadMe = async () => {
      if (!currentUserRef.current) setAuthInitializing(true);
      try {
        const response = await api.get('/auth/me', { headers: authHeaders });
        if (!cancelled) setCurrentUser(response.data.user);
      } catch (error) {
        if (!cancelled) endSession({ expired: true });
      } finally {
        if (!cancelled) setAuthInitializing(false);
      }
    };
    loadMe();
    return () => { cancelled = true; };
  }, [api, authHeaders, currentUserRef, endSession, setAuthInitializing, setCurrentUser, token]);
}
