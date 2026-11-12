import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { mocks, resetControllerMocks } from './controllerTestHarness';
import { configureAccounts, deferred, signIn, waitForSession } from './sessionTestHelpers';
import { useMessageController } from '../useMessageController';

beforeEach(() => { resetControllerMocks(); configureAccounts(); });
afterEach(cleanup);

it('does not expire B or overwrite its action state when an old A request fails with 401', async () => {
  const pending = deferred();
  const { result } = renderHook(useMessageController);
  await waitForSession(result);
  mocks.api.delete.mockImplementation(() => pending.promise);
  let deleting;
  act(() => { deleting = result.current.handleDeleteMessage({ id: 'A message' }); });
  act(() => result.current.handleLogout());
  await signIn(result);
  const current = result.current.attachmentAccess;
  const notices = result.current.toasts;
  await act(async () => {
    pending.reject({ response: { status: 401 } });
    await deleting;
  });
  expect(result.current.currentUser.id).toBe('second');
  expect(result.current.attachmentAccess).toBe(current);
  expect(current.isCurrent()).toBe(true);
  expect(result.current.messageActionKey).toBe('');
  expect(result.current.toasts).toEqual(notices);
});
