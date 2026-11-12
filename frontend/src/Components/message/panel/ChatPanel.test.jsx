import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import ChatPanel from '../ChatPanel';
import { chatPanelProps } from '../../../test-support/chatPanelProps';

afterEach(cleanup);

test('message search opens, focuses, and clears when Escape is pressed', () => {
  const props = chatPanelProps();
  render(<ChatPanel {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Search messages' }));
  const search = screen.getByRole('textbox', { name: 'Search messages in this chat' });
  expect(search).toHaveFocus();
  fireEvent.change(search, { target: { value: 'hello' } });
  expect(props.setMessageSearch).toHaveBeenCalledWith('hello');
  fireEvent.keyDown(search, { key: 'Escape' });
  expect(props.setMessageSearch).toHaveBeenLastCalledWith('');
  expect(screen.queryByRole('search')).not.toBeInTheDocument();
});

test('pagination avoids overlapping requests and allows another request after loading', () => {
  const props = chatPanelProps({ hasMoreMessages: true });
  const view = render(<ChatPanel {...props} />);
  const load = screen.getByRole('button', { name: 'Load older messages' });
  fireEvent.click(load);
  fireEvent.click(load);
  expect(props.handleLoadOlderMessages).toHaveBeenCalledTimes(1);
  view.rerender(<ChatPanel {...props} isLoadingOlderMessages />);
  expect(screen.getByRole('button', { name: 'Loading older messages...' })).toBeDisabled();
  view.rerender(<ChatPanel {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Load older messages' }));
  expect(props.handleLoadOlderMessages).toHaveBeenCalledTimes(2);
});

test('message rows retain reply, attachment, and context menu actions', () => {
  const message = {
    id: 'message', text: 'Hello', sender: { id: 'peer', username: 'Peer' },
    createdAt: '2026-10-19T08:00:00Z',
    attachments: [{ url: 'https://example.com/report.pdf', fileName: 'report.pdf' }],
  };
  const props = chatPanelProps({ messages: [message] });
  render(<ChatPanel {...props} />);
  expect(screen.getByRole('button', { name: 'Download report.pdf' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Reply to message' }));
  expect(props.setReplyTarget).toHaveBeenCalledWith(message);
  fireEvent.contextMenu(screen.getByText('Hello').closest('.message-bubble'));
  expect(props.handleOpenMessageContextMenu).toHaveBeenCalledWith(expect.anything(), message, false);
});
