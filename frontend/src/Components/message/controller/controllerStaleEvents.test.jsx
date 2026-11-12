import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { mocks, peer, resetControllerMocks } from './controllerTestHarness';
import { configureAccounts, signIn, waitForSession } from './sessionTestHelpers';
import { useMessageController } from '../useMessageController';

beforeEach(() => { resetControllerMocks(); configureAccounts(); });
afterEach(cleanup);

it('disconnects immediately and ignores obsolete socket messages, presence and notifications', async () => {
  const { result } = renderHook(useMessageController);
  await waitForSession(result);
  const oldHandlers = new Map(mocks.handlers);
  act(() => {
    result.current.handleLogout();
    expect(mocks.socket.disconnect).toHaveBeenCalled();
  });
  await signIn(result);
  const previousToasts = result.current.toasts;
  const previousChats = result.current.filteredChats;
  const calls = mocks.api.get.mock.calls.length;
  act(() => {
    oldHandlers.get('message:new')({ id: 'old', chatId: 'chat-a', sender: peer, text: 'private' });
    oldHandlers.get('presence:update')({ userId: peer.id, isOnline: true });
    oldHandlers.get('notification:new_message')({ message: { sender: peer, text: 'private' } });
    oldHandlers.get('chat:list:refresh')();
  });
  expect(result.current.toasts).toEqual(previousToasts);
  expect(result.current.filteredChats).toEqual(previousChats);
  expect(result.current.friends[0].isOnline).toBeUndefined();
  expect(mocks.api.get).toHaveBeenCalledTimes(calls);
});

it('ignores a previous-session send acknowledgement while B is composing a reply', async () => {
  let acknowledge;
  mocks.socket.emit.mockImplementation((event, payload, callback) => {
    if (event === 'message:send') acknowledge = callback;
  });
  const { result } = renderHook(useMessageController);
  await waitForSession(result);
  act(() => result.current.setActiveChatId('chat-a'));
  act(() => result.current.setMessageText('A draft'));
  act(() => result.current.handleSendMessage());
  expect(acknowledge).toBeTypeOf('function');
  act(() => result.current.handleLogout());
  await signIn(result);
  act(() => {
    result.current.setActiveChatId('second-chat');
    result.current.setMessageText('B draft');
    result.current.setReplyTarget({ id: 'B reply' });
    result.current.setPendingAttachments([{ uploadId: 'B upload' }]);
    result.current.setShowEmojiPicker(true);
  });
  await act(async () => acknowledge({}));
  expect(result.current.messageText).toBe('B draft');
  expect(result.current.replyTarget.id).toBe('B reply');
  expect(result.current.pendingAttachments[0].uploadId).toBe('B upload');
  expect(result.current.showEmojiPicker).toBe(true);
});
