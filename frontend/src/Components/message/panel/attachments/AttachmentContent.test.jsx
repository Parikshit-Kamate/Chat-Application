import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import MessageAttachments from '../MessageAttachments';
import { API_URL } from '../../constants';
import { attachment, createAccess, mockAttachmentBrowser, response } from './attachmentTestSupport';

let fetchMock;
beforeEach(() => { fetchMock = mockAttachmentBrowser(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('image previews fetch the protected endpoint with bearer authentication', async () => {
  render(<MessageAttachments message={{ id: 'm', attachments: [attachment] }}
    attachmentAccess={createAccess()} />);
  expect(await screen.findByRole('img', { name: 'photo.png' })).toHaveAttribute('src', 'blob:test-attachment');
  expect(fetchMock).toHaveBeenCalledWith(`${API_URL}${attachment.downloadUrl}`, expect.objectContaining({
    headers: { Authorization: 'Bearer test-session' },
    cache: 'no-store', redirect: 'error', credentials: 'omit',
  }));
  cleanup();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-attachment');
});

test('non-image files download on demand through an authenticated blob', async () => {
  fetchMock.mockResolvedValue(response('application/pdf', '%PDF-synthetic'));
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  const file = { ...attachment, resourceType: 'raw', fileName: 'report.pdf' };
  render(<MessageAttachments message={{ id: 'm', attachments: [file] }} attachmentAccess={createAccess()} />);
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Download report.pdf' }));
  await vi.waitFor(() => expect(click).toHaveBeenCalledOnce());
  expect(click.mock.instances[0].href).toBe('blob:test-attachment');
  expect(click.mock.instances[0].download).toBe('report.pdf');
});

test('external and legacy provider URLs never receive the session token', async () => {
  const file = { ...attachment, resourceType: 'raw', downloadUrl: 'https://attacker.invalid/file' };
  render(<MessageAttachments message={{ id: 'm', attachments: [file] }} attachmentAccess={createAccess()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Download photo.png' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Attachment unavailable');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
