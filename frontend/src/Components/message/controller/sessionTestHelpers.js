import { act, waitFor } from '@testing-library/react';
import { expect } from 'vitest';
import { mocks, peer, respond, user } from './controllerTestHarness';

export const secondUser = { id: 'second', username: 'Second' };
export const secondChat = { id: 'second-chat', type: 'direct', members: [secondUser, peer] };

export function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
}

export function configureAccounts() {
  const original = mocks.api.get.getMockImplementation();
  mocks.api.get.mockImplementation((url, options) => {
    const second = options?.headers?.Authorization === 'Bearer token-b';
    if (url === '/auth/me') return respond({ user: second ? secondUser : user });
    if (url === '/chats' && second) return respond({ chats: [secondChat] });
    return original(url, options);
  });
}

export async function waitForSession(result) {
  await waitFor(() => expect(result.current.currentUser).not.toBeNull());
  await waitFor(() => expect(result.current.isChatListInitializing).toBe(false));
}

export async function signIn(result, token = 'token-b', nextUser = secondUser) {
  mocks.api.post.mockImplementation((url) => respond(
    url === '/auth/login' ? { token, user: nextUser } : {}
  ));
  act(() => result.current.setAuthForm({ username: nextUser.username, password: 'test-password' }));
  await act(() => result.current.handleAuthSubmit({ preventDefault() {} }));
  await waitForSession(result);
}
