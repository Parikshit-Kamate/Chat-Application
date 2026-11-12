export const MESSAGE_PAGE_SIZE = 40;
export const EMPTY_MESSAGE_PAGE_INFO = {
  hasMore: false,
  nextCursor: '',
};

export function createClientMessageId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

export function getNextMessagePageInfo(pageInfo) {
  return {
    hasMore: Boolean(pageInfo?.hasMore),
    nextCursor: pageInfo?.nextCursor || '',
  };
}
