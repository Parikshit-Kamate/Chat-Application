import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mocks, resetControllerMocks, respond, user } from './controllerTestHarness';
import { useMessageController } from '../useMessageController';
import { TOKEN_KEY } from '../constants';

beforeEach(() => resetControllerMocks());
afterEach(cleanup);

describe('message controller session lifecycle', () => {
  it('restores the session and clears conversation state when signing out', async () => {
    const { result } = renderHook(useMessageController);
    expect(result.current.authInitializing).toBe(true);
    await waitFor(() => expect(result.current.friends).toHaveLength(1));
    expect(result.current.currentUser).toEqual(user);
    expect(mocks.connect).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      auth: { token: 'saved-token' },
    }));

    act(() => {
      result.current.setActiveChatId('chat-a');
      result.current.setPendingAttachments([{ publicId: 'uploaded' }]);
      result.current.setReplyTarget({ id: 'reply' });
      result.current.setGroupBuilderOpen(true);
    });
    act(() => result.current.handleLogout());

    expect(result.current.currentUser).toBeNull();
    expect(result.current.activeChatId).toBeNull();
    expect(result.current.messages).toEqual([]);
    expect(result.current.friends).toEqual([]);
    expect(result.current.pendingAttachments).toEqual([]);
    expect(result.current.replyTarget).toBeNull();
    expect(result.current.groupBuilderOpen).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(mocks.socket.disconnect).toHaveBeenCalled();
  });

  it('validates credentials and completes sign in through the existing public action', async () => {
    resetControllerMocks({ savedSession: false });
    mocks.api.post.mockImplementation(() => respond({ token: 'new-token', user }));
    const { result } = renderHook(useMessageController);
    const event = { preventDefault: vi.fn() };
    await act(() => result.current.handleAuthSubmit(event));
    expect(mocks.api.post).not.toHaveBeenCalled();
    expect(result.current.toasts[0].text).toBe('Username and password are required.');

    act(() => result.current.setAuthForm({ username: ' me@example.com ', password: 'secret' }));
    await act(() => result.current.handleAuthSubmit(event));
    expect(mocks.api.post).toHaveBeenCalledWith('/auth/login', {
      username: 'me@example.com', password: 'secret',
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    await waitFor(() => expect(result.current.currentUser).toEqual(user));
    expect(result.current.authForm.password).toBe('');
    expect(result.current.authLoading).toBe(false);
    expect(localStorage.getItem(TOKEN_KEY)).toBe('new-token');
  });

  it('removes an expired saved session without opening a socket', async () => {
    mocks.api.get.mockRejectedValue(new Error('expired'));
    const { result } = renderHook(useMessageController);
    await waitFor(() => expect(result.current.authInitializing).toBe(false));
    expect(result.current.currentUser).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(result.current.toasts[0].text).toBe('Session expired. Please sign in again.');
  });
});
