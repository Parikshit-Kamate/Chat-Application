import { useState } from 'react';
import { TOKEN_KEY } from '../constants';

export function useAuthState() {
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

  return {
    token, setToken, authMode, setAuthMode, authForm, setAuthForm, authLoading, setAuthLoading,
    authInitializing, setAuthInitializing, currentUser, setCurrentUser,
  };
}
