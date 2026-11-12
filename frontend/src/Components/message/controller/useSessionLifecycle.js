import { useMemo } from 'react';
import { resetControllerState } from './resetControllerState';

function showSessionNotice(setToasts, session, text, tone) {
  if (!text) return;
  const id = `${Date.now()}-${Math.random()}`;
  setToasts([{ id, text, tone }]);
  window.setTimeout(() => {
    if (session.isCurrent()) {
      setToasts((toasts) => session.isCurrent() ? toasts.filter((toast) => toast.id !== id) : toasts);
    }
  }, 3200);
}

export function useSessionLifecycle(state, { session, replaceSession }) {
  return useMemo(() => {
    const transition = (next, notice, tone) => {
      if (!session.isCurrent()) return;
      const access = replaceSession(next.token || '');
      resetControllerState(state, next);
      showSessionNotice(state.setToasts, access, notice, tone);
    };
    return {
      startSession: ({ notice, ...next }) => transition(next, notice, 'success'),
      endSession: ({ expired = false } = {}) => transition({},
        expired ? 'Session expired. Please sign in again.' : '', 'danger'),
    };
    // State setters are stable; the session identity defines each lifecycle.
  }, [session, replaceSession]);
}
