import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { mocks, peer, resetControllerMocks, user } from './controllerTestHarness';
import { configureAccounts, deferred, secondChat, signIn, waitForSession } from './sessionTestHelpers';
import { useMessageController } from '../useMessageController';

beforeEach(() => { resetControllerMocks(); configureAccounts(); });
afterEach(cleanup);

it('aborts A requests and rejects a late A chat response after B finishes signing in', async () => {
  const pending = deferred();
  const original = mocks.api.get.getMockImplementation();
  mocks.api.get.mockImplementation((url, options) => url === '/chats' &&
    options.headers.Authorization === 'Bearer saved-token' ? pending.promise : original(url, options));
  const { result } = renderHook(useMessageController);
  await waitFor(() => expect(mocks.api.get).toHaveBeenCalledWith('/chats', expect.anything()));
  const old = result.current.attachmentAccess;
  act(() => {
    result.current.handleLogout();
    expect(old.isCurrent()).toBe(false);
    expect(old.signal.aborted).toBe(true);
  });
  await signIn(result);
  await act(async () => pending.resolve({ data: { chats: [{ id: 'a-secret' }] } }));
  expect(result.current.filteredChats).toEqual([secondChat]);
  expect(result.current.currentUser.id).toBe('second');
});

it('isolates an identical-token relogin from its previous pending request and setters', async () => {
  const pending = deferred();
  const original = mocks.api.get.getMockImplementation();
  let first = true;
  mocks.api.get.mockImplementation((url, options) => {
    if (url === '/friends' && first) { first = false; return pending.promise; }
    return original(url, options);
  });
  const { result } = renderHook(useMessageController);
  await waitForSession(result);
  const old = result.current.attachmentAccess;
  const oldSetter = result.current.setMessageText;
  act(() => result.current.handleLogout());
  await signIn(result, 'saved-token', user);
  expect(result.current.attachmentAccess.token).toBe(old.token);
  expect(result.current.attachmentAccess.sessionId).not.toBe(old.sessionId);
  await act(async () => pending.resolve({ data: { friends: [{ id: 'stale-private-friend' }] } }));
  act(() => oldSetter('stale private draft'));
  expect(result.current.friends).toEqual([peer]);
  expect(result.current.messageText).toBe('');
});

it('rotates scope on same-token authentication without logout and remains valid in StrictMode', async () => {
  const wrapper = ({ children }) => <React.StrictMode>{children}</React.StrictMode>;
  const { result } = renderHook(useMessageController, { wrapper });
  await waitForSession(result);
  const old = result.current.attachmentAccess;
  act(() => result.current.setMessageText('private draft'));
  await signIn(result, 'saved-token', user);
  expect(old.isCurrent()).toBe(false);
  expect(result.current.attachmentAccess.isCurrent()).toBe(true);
  expect(result.current.attachmentAccess.sessionId).not.toBe(old.sessionId);
  expect(result.current.messageText).toBe('');
});
