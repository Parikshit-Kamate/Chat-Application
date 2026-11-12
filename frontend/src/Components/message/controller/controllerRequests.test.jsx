import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { mocks, resetControllerMocks } from './controllerTestHarness';
import { useMessageController } from '../useMessageController';

beforeEach(() => resetControllerMocks());
afterEach(cleanup);

it('ignores an earlier conversation request after a newer conversation has loaded', async () => {
  const originalGet = mocks.api.get.getMockImplementation();
  const pending = new Map();
  mocks.api.get.mockImplementation((url, options) => {
    if (url === '/chats/chat-a/messages' || url === '/chats/chat-b/messages') {
      return new Promise((resolve) => pending.set(url, resolve));
    }
    return originalGet(url, options);
  });
  const { result } = renderHook(useMessageController);
  await waitFor(() => expect(mocks.handlers.has('message:new')).toBe(true));
  act(() => result.current.setActiveChatId('chat-a'));
  await waitFor(() => expect(pending.has('/chats/chat-a/messages')).toBe(true));
  act(() => result.current.setActiveChatId('chat-b'));
  await waitFor(() => expect(pending.has('/chats/chat-b/messages')).toBe(true));

  const message = { id: 'newer', chatId: 'chat-b', text: 'Latest conversation' };
  await act(async () => pending.get('/chats/chat-b/messages')({
    data: { messages: [message], pageInfo: { hasMore: false } },
  }));
  expect(result.current.messages).toEqual([message]);

  await act(async () => pending.get('/chats/chat-a/messages')({
    data: { messages: [{ id: 'older', chatId: 'chat-a' }], pageInfo: { hasMore: true } },
  }));
  expect(result.current.activeChatId).toBe('chat-b');
  expect(result.current.messages).toEqual([message]);
  expect(result.current.hasMoreMessages).toBe(false);
  expect(result.current.isLoadingMessages).toBe(false);
});
