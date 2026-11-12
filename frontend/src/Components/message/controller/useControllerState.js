import { useMemo } from 'react';
import { useAuthState } from './useAuthState';
import { useDirectoryState } from './useDirectoryState';
import { useSearchState } from './useSearchState';
import { useComposerState } from './useComposerState';
import { useInterfaceState } from './useInterfaceState';
import { useSessionScope } from './useSessionScope';
import { useSessionLifecycle } from './useSessionLifecycle';
import { guardSessionSetters } from './guardSessionSetters';

export function useControllerState() {
  const state = {
    ...useAuthState(),
    ...useDirectoryState(),
    ...useSearchState(),
    ...useComposerState(),
    ...useInterfaceState(),
  };
  const scope = useSessionScope(state.token);
  const lifecycle = useSessionLifecycle(state, scope);
  // Only setter identities are captured; each hook keeps them stable.
  const setters = useMemo(() => guardSessionSetters(state, scope.session), [scope.session]);
  const attachmentAccess = useMemo(() => ({
    ...scope.session,
    expire: () => lifecycle.endSession({ expired: true }),
  }), [scope.session, lifecycle.endSession]);
  return { ...state, ...setters, ...lifecycle, session: scope.session, attachmentAccess };
}
