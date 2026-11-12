import { useEffect } from 'react';
import { getSessionExpiresAt } from './getSessionExpiresAt';

export function useSessionExpiry({ session, endSession }) {
  useEffect(() => {
    const expiresAt = getSessionExpiresAt(session.token);
    if (!expiresAt || !session.isCurrent()) return;
    let timer;
    const clear = () => window.clearTimeout(timer);
    const check = () => {
      if (!session.isCurrent()) return;
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) endSession({ expired: true });
      else timer = window.setTimeout(check, Math.min(remaining, 2_147_483_647));
    };
    session.signal.addEventListener('abort', clear, { once: true });
    check();
    return () => {
      clear();
      session.signal.removeEventListener('abort', clear);
    };
  }, [session, endSession]);
}
