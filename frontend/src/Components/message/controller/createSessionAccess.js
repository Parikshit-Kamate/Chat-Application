let nextSessionId = 0;

export function createSessionAccess(owner, token) {
  const abort = new AbortController();
  const scope = {
    access: {
      token,
      sessionId: ++nextSessionId,
      signal: abort.signal,
      isCurrent: () => owner.current === scope && !abort.signal.aborted,
    },
    invalidate: () => abort.abort(),
  };
  return scope;
}
