import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { mocks, resetControllerMocks } from './controllerTestHarness';
import { configureAccounts, signIn, waitForSession } from './sessionTestHelpers';
import { expectPrivateStateCleared, fillPrivateState } from './sessionStateAssertions';
import { useMessageController } from '../useMessageController';
import { TOKEN_KEY } from '../constants';

beforeEach(() => { resetControllerMocks(); configureAccounts(); });
afterEach(cleanup);

it('clears private drafts, searches, forms, attachments, UI and toasts on logout', async () => {
  const { result } = renderHook(useMessageController);
  await waitForSession(result);
  fillPrivateState(result);
  expect(result.current.toasts.at(-1).text).toContain('private toast');
  act(() => {
    result.current.handleLogout();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });
  expectPrivateStateCleared(result);
  expect(result.current.toasts).toEqual([]);
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  await signIn(result);
  act(() => result.current.setActiveChatId('second-chat'));
  expect(result.current.messageText).toBe('');
  expect(result.current.messageSearch).toBe('');
  expect(result.current.groupForm.name).toBe('');
});

it('clears the same state when an authenticated request reports an expired session', async () => {
  const { result } = renderHook(useMessageController);
  await waitForSession(result);
  fillPrivateState(result);
  const access = result.current.attachmentAccess;
  mocks.api.delete.mockRejectedValue({ response: { status: 401 } });
  await act(() => result.current.handleDeleteMessage({ id: 'message' }));
  await waitFor(() => expect(result.current.currentUser).toBeNull());
  expectPrivateStateCleared(result);
  expect(access.isCurrent()).toBe(false);
  expect(access.signal.aborted).toBe(true);
  expect(result.current.toasts.map((toast) => toast.text)).toEqual([
    'Session expired. Please sign in again.',
  ]);
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
});
