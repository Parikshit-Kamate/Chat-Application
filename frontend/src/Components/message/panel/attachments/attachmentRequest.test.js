import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { requestAttachment } from './attachmentRequest';
import { attachment, createAccess, mockAttachmentBrowser, response } from './attachmentTestSupport';

let fetchMock;
beforeEach(() => { fetchMock = mockAttachmentBrowser(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('redirect and error responses fail without exposing provider URLs', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 403 });
  await expect(requestAttachment(attachment, createAccess(), new AbortController().signal))
    .rejects.toThrow('Attachment unavailable');
  expect(fetchMock.mock.calls[0][1].redirect).toBe('error');
});

test('active content and oversized attachment responses are rejected', async () => {
  fetchMock.mockResolvedValue(response('text/html', '<script>malicious</script>'));
  await expect(requestAttachment(attachment, createAccess(), new AbortController().signal))
    .rejects.toThrow('Attachment unavailable');
  const large = response();
  large.headers.set('content-length', String(11 * 1024 * 1024));
  fetchMock.mockResolvedValue(large);
  await expect(requestAttachment(attachment, createAccess(), new AbortController().signal))
    .rejects.toThrow('Attachment unavailable');
});

test('a protected download401 expires only its current session', async () => {
  const access = createAccess();
  access.expire = vi.fn(access.end);
  fetchMock.mockResolvedValue({ ok: false, status: 401 });
  await expect(requestAttachment(attachment, access, new AbortController().signal))
    .rejects.toThrow('Attachment unavailable');
  expect(access.expire).toHaveBeenCalledOnce();
  expect(access.signal.aborted).toBe(true);
});

test('a late download401 cannot invoke expiry after its session ends', async () => {
  let resolve;
  const access = createAccess();
  access.expire = vi.fn();
  fetchMock.mockReturnValue(new Promise((done) => { resolve = done; }));
  const pending = requestAttachment(attachment, access, new AbortController().signal);
  access.end();
  resolve({ ok: false, status: 401 });
  await expect(pending).rejects.toThrow('Attachment unavailable');
  expect(access.expire).not.toHaveBeenCalled();
});
