import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import MessageComposer from './MessageComposer';
import { MAX_PENDING_ATTACHMENTS } from '../attachmentUploads';
import { EMOJI_SET } from '../constants';
import { chatPanelProps } from '../../../test-support/chatPanelProps';

afterEach(cleanup);

test('attachment limit and upload status disable the appropriate composer controls', () => {
  const props = chatPanelProps({
    pendingAttachments: Array.from({ length: MAX_PENDING_ATTACHMENTS }, () => ({ fileName: 'file' })),
  });
  const view = render(<MessageComposer {...props} />);
  expect(screen.getByLabelText('Attach files')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled();
  view.rerender(<MessageComposer {...props} pendingAttachments={[]} uploading />);
  expect(screen.getByLabelText('Attach files')).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Sending message' })).toBeDisabled();
});

test('composer preserves attachment removal, emoji insertion, and sending', () => {
  const attachment = { fileName: 'notes.txt' };
  const props = chatPanelProps({ pendingAttachments: [attachment], showEmojiPicker: true });
  const view = render(<MessageComposer {...props} />);
  fireEvent.click(screen.getByText('notes.txt').closest('.pending-chip').querySelector('button'));
  expect(props.setPendingAttachments.mock.calls[0][0]([attachment])).toEqual([]);
  fireEvent.click(screen.getByRole('button', { name: EMOJI_SET[0] }));
  expect(props.setMessageText.mock.calls[0][0]('Hello')).toBe(`Hello${EMOJI_SET[0]}`);
  view.rerender(<MessageComposer {...props} pendingAttachments={[]} />);
  fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
  expect(props.handleSendMessage).toHaveBeenCalledTimes(1);
});
