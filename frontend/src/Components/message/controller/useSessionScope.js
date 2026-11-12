import { useCallback, useEffect, useRef, useState } from 'react';
import { createSessionAccess } from './createSessionAccess';

export function useSessionScope(token) {
  const owner = useRef(null);
  const mountGeneration = useRef(0);
  const [, setGeneration] = useState(0);

  if (!owner.current || owner.current.access.token !== token) {
    owner.current?.invalidate();
    owner.current = createSessionAccess(owner, token);
  }

  const replaceSession = useCallback((nextToken) => {
    owner.current.invalidate();
    owner.current = createSessionAccess(owner, nextToken);
    setGeneration((value) => value + 1);
    return owner.current.access;
  }, []);

  useEffect(() => {
    const generation = ++mountGeneration.current;
    return () => {
      // A StrictMode effect replay remounts before this microtask runs.
      queueMicrotask(() => {
        if (mountGeneration.current === generation) owner.current.invalidate();
      });
    };
  }, []);

  return { session: owner.current.access, replaceSession };
}
