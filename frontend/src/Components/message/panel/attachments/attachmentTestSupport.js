import { vi } from 'vitest';

export const uploadId = '64b000000000000000000004';
export const attachment = {
  uploadId,
  downloadUrl: `/api/uploads/${uploadId}/content`,
  resourceType: 'image',
  fileName: 'photo.png',
};

export function createAccess(token = 'test-session') {
  const controller = new AbortController();
  return {
    token,
    sessionId: token,
    signal: controller.signal,
    isCurrent: () => !controller.signal.aborted,
    end: () => controller.abort(),
  };
}

export function response(type = 'image/png', body = 'synthetic file') {
  return {
    ok: true,
    headers: new Headers({ 'content-type': type }),
    blob: async () => new Blob([body], { type }),
  };
}

export function mockAttachmentBrowser() {
  const OriginalURL = globalThis.URL;
  class TestURL extends OriginalURL {}
  TestURL.createObjectURL = vi.fn(() => 'blob:test-attachment');
  TestURL.revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', TestURL);
  const fetchMock = vi.fn(() => Promise.resolve(response()));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
