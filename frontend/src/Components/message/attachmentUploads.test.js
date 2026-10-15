import { describe, expect, test, vi } from 'vitest';
import {
  createAttachmentReferences,
  MAX_ATTACHMENT_FILE_BYTES,
  uploadAttachmentBatch,
} from './attachmentUploads';

test('message attachment references contain only the server upload ID', () => {
  const references = createAttachmentReferences([
    {
      uploadId: '64b000000000000000000004',
      url: `data:image/png;base64,${'a'.repeat(180_000)}`,
      fileName: 'large-fallback.png',
    },
  ]);

  expect(references).toEqual([{ uploadId: '64b000000000000000000004' }]);
  expect(JSON.stringify(references)).not.toContain('data:image');
});

function file(name, size = 128) {
  return { name, size, type: 'image/png' };
}

describe('uploadAttachmentBatch', () => {
  test('uploads no more successful files than the available attachment slots', async () => {
    const serverAttachment = {
      fileName: 'one.png',
      uploadId: '507f1f77bcf86cd799439011',
      url: 'https://example.test/one.png',
    };
    const uploadFile = vi.fn().mockResolvedValue({ file: serverAttachment });
    const onUploaded = vi.fn();

    const uploaded = await uploadAttachmentBatch({
      files: [file('one.png'), file('two.png'), file('three.png')],
      availableSlots: 1,
      uploadFile,
      onUploaded,
    });

    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(uploaded).toEqual([serverAttachment]);
    expect(uploaded[0]).toBe(serverAttachment);
    expect(onUploaded).toHaveBeenCalledWith(serverAttachment, { file: serverAttachment }, expect.any(Object));
  });

  test('keeps each success and continues after an individual file fails', async () => {
    const firstAttachment = { fileName: 'first.png', uploadId: '507f1f77bcf86cd799439012' };
    const thirdAttachment = { fileName: 'third.png', uploadId: '507f1f77bcf86cd799439013' };
    const uploadFile = vi
      .fn()
      .mockResolvedValueOnce({ file: firstAttachment })
      .mockRejectedValueOnce(new Error('network failure'))
      .mockResolvedValueOnce({ file: thirdAttachment });
    const added = [];
    const rejected = [];

    const uploaded = await uploadAttachmentBatch({
      files: [file('first.png'), file('second.png'), file('third.png')],
      availableSlots: 3,
      uploadFile,
      onUploaded: (attachment) => added.push(attachment),
      onRejected: (error, rejectedFile) => rejected.push([error.message, rejectedFile.name]),
    });

    expect(uploaded).toEqual([firstAttachment, thirdAttachment]);
    expect(added).toEqual([firstAttachment, thirdAttachment]);
    expect(rejected).toEqual([['network failure', 'second.png']]);
  });

  test('does not let an oversized file consume an available slot', async () => {
    const validAttachment = { fileName: 'valid.png', uploadId: '507f1f77bcf86cd799439014' };
    const uploadFile = vi.fn().mockResolvedValue({ file: validAttachment });
    const onOversized = vi.fn();

    const uploaded = await uploadAttachmentBatch({
      files: [file('large.png', MAX_ATTACHMENT_FILE_BYTES + 1), file('valid.png')],
      availableSlots: 1,
      uploadFile,
      onOversized,
    });

    expect(onOversized).toHaveBeenCalledWith(expect.objectContaining({ name: 'large.png' }));
    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(uploadFile).toHaveBeenCalledWith(expect.objectContaining({ name: 'valid.png' }));
    expect(uploaded).toEqual([validAttachment]);
  });
});
