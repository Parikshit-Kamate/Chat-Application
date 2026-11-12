import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import MessageAttachments from '../MessageAttachments';
import { attachment, createAccess, mockAttachmentBrowser } from './attachmentTestSupport';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('offscreen image previews release their blob and reload when visible', async () => {
  const fetchMock = mockAttachmentBrowser();
  let notify;
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback) { notify = callback; }
    observe() {}
    disconnect() {}
  });
  render(<MessageAttachments message={{ id: 'm', attachments: [attachment] }}
    attachmentAccess={createAccess()} />);
  expect(fetchMock).not.toHaveBeenCalled();
  act(() => notify([{ isIntersecting: true }]));
  await screen.findByRole('img', { name: 'photo.png' });
  act(() => notify([{ isIntersecting: false }]));
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-attachment');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  act(() => notify([{ isIntersecting: true }]));
  await screen.findByRole('img', { name: 'photo.png' });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
