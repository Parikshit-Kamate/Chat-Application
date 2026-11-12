import React, { StrictMode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import MessageAttachments from '../MessageAttachments';
import { attachment, createAccess, mockAttachmentBrowser, response } from './attachmentTestSupport';

let fetchMock;
beforeEach(() => { fetchMock = mockAttachmentBrowser(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const message = { id: 'm', attachments: [attachment] };

test('logout aborts downloads and revokes already displayed object URLs', async () => {
  const access = createAccess();
  const view = render(<MessageAttachments message={message} attachmentAccess={access} />);
  await screen.findByRole('img', { name: 'photo.png' });
  act(() => access.end());
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-attachment');
  view.rerender(<MessageAttachments message={message} />);
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download photo.png' })).toBeDisabled();
});

test('a late old-session response cannot create a blob in the next session', async () => {
  let resolveOld;
  fetchMock.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
  const access = createAccess('old-session');
  const view = render(<MessageAttachments message={message} attachmentAccess={access} />);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  act(() => access.end());
  fetchMock.mockResolvedValue({ ok: false });
  view.rerender(<MessageAttachments message={message} attachmentAccess={createAccess('new-session')} />);
  await act(async () => { resolveOld(response()); });
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
});

test('image fetching survives StrictMode effect cleanup and reinitialization', async () => {
  render(<StrictMode><MessageAttachments message={message} attachmentAccess={createAccess()} /></StrictMode>);
  expect(await screen.findByRole('img', { name: 'photo.png' })).toHaveAttribute('src', 'blob:test-attachment');
});
