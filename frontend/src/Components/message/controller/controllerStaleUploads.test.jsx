import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { mocks, resetControllerMocks } from './controllerTestHarness';
import { configureAccounts, deferred, signIn, waitForSession } from './sessionTestHelpers';
import { useMessageController } from '../useMessageController';

beforeEach(() => { resetControllerMocks(); configureAccounts(); });
afterEach(cleanup);

it('does not apply A upload callbacks or clear B upload state and file input', async () => {
  const first = deferred();
  const second = deferred();
  const { result } = renderHook(useMessageController);
  await waitForSession(result);
  mocks.api.post.mockImplementation(() => first.promise);
  const input = { files: [new File(['a'], 'a.txt', { type: 'text/plain' })], value: 'A selection' };
  let taskA;
  act(() => { taskA = result.current.handleFileSelection({ target: input, currentTarget: input }); });
  await waitFor(() => expect(mocks.api.post).toHaveBeenCalledWith(
    '/uploads', expect.objectContaining({ fileName: 'a.txt' }), expect.anything()
  ));
  act(() => result.current.handleLogout());
  await signIn(result);
  mocks.api.post.mockImplementation(() => second.promise);
  input.files = [new File(['b'], 'b.txt', { type: 'text/plain' })];
  input.value = 'B selection';
  let taskB;
  act(() => { taskB = result.current.handleFileSelection({ target: input, currentTarget: input }); });
  await waitFor(() => expect(mocks.api.post).toHaveBeenCalledWith(
    '/uploads', expect.objectContaining({ fileName: 'b.txt' }), expect.anything()
  ));
  await act(async () => {
    first.resolve({ data: { file: { uploadId: 'A upload', fileName: 'a.txt' } } });
    await taskA;
  });
  expect(result.current.uploading).toBe(true);
  expect(result.current.pendingAttachments).toEqual([]);
  expect(input.value).toBe('B selection');
  await act(async () => {
    second.resolve({ data: { file: { uploadId: 'B upload', fileName: 'b.txt' } } });
    await taskB;
  });
  expect(result.current.uploading).toBe(false);
  expect(result.current.pendingAttachments.map((file) => file.uploadId)).toEqual(['B upload']);
  expect(input.value).toBe('');
});
