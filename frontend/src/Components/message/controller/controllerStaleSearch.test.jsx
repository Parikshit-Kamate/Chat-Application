import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { mocks, resetControllerMocks } from './controllerTestHarness';
import { configureAccounts, deferred, signIn, waitForSession } from './sessionTestHelpers';
import { useMessageController } from '../useMessageController';

beforeEach(() => { resetControllerMocks(); configureAccounts(); });
afterEach(cleanup);

it('ignores A message and user search responses after B has signed in', async () => {
  const messages = deferred();
  const users = deferred();
  const original = mocks.api.get.getMockImplementation();
  mocks.api.get.mockImplementation((url, options) => {
    if (url === '/search/messages') return messages.promise;
    if (url === '/users' && options.params?.query) return users.promise;
    return original(url, options);
  });
  const { result } = renderHook(useMessageController);
  await waitForSession(result);
  act(() => {
    result.current.setGlobalSearch('private');
    result.current.setFriendSearch('private');
  });
  await waitFor(() => expect(mocks.api.get).toHaveBeenCalledWith('/search/messages', expect.anything()));
  await waitFor(() => expect(mocks.api.get).toHaveBeenCalledWith('/users', expect.objectContaining({
    params: { query: 'private' },
  })));
  act(() => result.current.handleLogout());
  await signIn(result);
  await act(async () => {
    messages.resolve({ data: { results: [{ id: 'A result', text: 'A private message' }] } });
    users.resolve({ data: { users: [{ id: 'A contact', username: 'A private name' }] } });
  });
  expect(result.current.globalResults).toEqual([]);
  expect(result.current.filteredFriendSearchResults).toEqual([]);
  expect(result.current.isSearchingUsers).toBe(false);
});
