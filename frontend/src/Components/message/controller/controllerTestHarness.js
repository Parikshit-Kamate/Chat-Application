import { vi } from 'vitest';
import { TOKEN_KEY } from '../constants';

const mocks = vi.hoisted(() => {
  const handlers = new Map();
  const socket = {
    on: vi.fn((event, handler) => handlers.set(event, handler)),
    off: vi.fn((event) => handlers.delete(event)),
    emit: vi.fn((event, payload, acknowledge) => acknowledge?.({})),
    disconnect: vi.fn(),
  };
  return {
    handlers,
    socket,
    connect: vi.fn(() => socket),
    api: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  };
});

export { mocks };

vi.mock('axios', () => ({ default: { create: () => mocks.api } }));
vi.mock('socket.io-client', () => ({ default: mocks.connect }));

export const user = { id: 'me', username: 'me@example.com' };
export const peer = { id: 'peer', username: 'friend@example.com', firstName: 'Sam' };
export const chats = ['chat-a', 'chat-b'].map((id) => ({
  id,
  type: 'direct',
  members: [user, peer],
  unreadCount: 0,
}));

export function respond(data) {
  return Promise.resolve({ data });
}

export function resetControllerMocks({ savedSession = true } = {}) {
  vi.clearAllMocks();
  mocks.socket.emit.mockImplementation((event, payload, acknowledge) => acknowledge?.({}));
  mocks.handlers.clear();
  localStorage.clear();
  if (savedSession) localStorage.setItem(TOKEN_KEY, 'saved-token');
  mocks.api.get.mockImplementation((url) => {
    if (url === '/auth/me') return respond({ user });
    if (url === '/users') return respond({ users: [peer] });
    if (url === '/friends') return respond({ friends: [peer] });
    if (url === '/chats') return respond({ chats });
    if (url.endsWith('/messages')) {
      return respond({ messages: [], pageInfo: { hasMore: false, nextCursor: '' } });
    }
    return respond({});
  });
  mocks.api.post.mockImplementation(() => respond({}));
  mocks.api.patch.mockImplementation(() => respond({}));
  mocks.api.delete.mockImplementation(() => respond({}));
}
