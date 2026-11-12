import { useCallback } from 'react';

export function useToasts(context) {
  const {
    setToasts,
  } = context;

  const pushToast = useCallback((text, tone = 'info') => {
    const toastId = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id: toastId, text, tone }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== toastId));
    }, 3200);
  }, [setToasts]);

  return {
    pushToast,
  };
}
