import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { resetControllerMocks } from './controllerTestHarness';
import { configureAccounts, signIn, waitForSession } from './sessionTestHelpers';
import { expectPrivateStateCleared, fillPrivateState } from './sessionStateAssertions';
import { useMessageController } from '../useMessageController';
import { TOKEN_KEY } from '../constants';

beforeEach(() => { resetControllerMocks(); configureAccounts(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('clears an idle session when its JWT expires and aborts its attachment access', async () => {
  vi.useFakeTimers();
  const exp = Math.floor(Date.now() / 1000) + 60;
  localStorage.setItem(TOKEN_KEY, `header.${btoa(JSON.stringify({ exp }))}.signature`);
  let result;
  await act(async () => { ({ result } = renderHook(useMessageController)); });
  expect(result.current.currentUser).not.toBeNull();
  fillPrivateState(result);
  const access = result.current.attachmentAccess;
  await act(async () => vi.advanceTimersByTimeAsync(60_000));
  expectPrivateStateCleared(result);
  expect(access.signal.aborted).toBe(true);
  expect(access.isCurrent()).toBe(false);
  expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
});

it('lets current attachment 401s expire the session while ignoring an obsolete access callback', async () => {
  const { result } = renderHook(useMessageController);
  await waitForSession(result);
  const old = result.current.attachmentAccess;
  act(() => result.current.handleLogout());
  await signIn(result);
  act(() => old.expire());
  expect(result.current.currentUser.id).toBe('second');
  fillPrivateState(result);
  act(() => result.current.attachmentAccess.expire());
  expectPrivateStateCleared(result);
});
