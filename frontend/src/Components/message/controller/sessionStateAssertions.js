import { act } from '@testing-library/react';
import { expect } from 'vitest';
import { mocks, peer } from './controllerTestHarness';

export function fillPrivateState(result) {
  act(() => {
    result.current.setMessageText('private draft');
    result.current.setMessageSearch('private message query');
    result.current.setSidebarSearch('private name');
    result.current.setGlobalSearch('private search');
    result.current.setFriendSearch('private friend');
    result.current.setGroupForm({ name: 'Private group', memberIds: ['private-member'] });
    result.current.setGroupBuilderOpen(true);
    result.current.setIsSettingsOpen(true);
    result.current.setShowEmojiPicker(true);
    result.current.setReplyTarget({ id: 'private-reply' });
    result.current.setPendingAttachments([{ uploadId: 'private-upload' }]);
    mocks.handlers.get('notification:new_message')({ message: { sender: peer, text: 'private toast' } });
  });
}

export function expectPrivateStateCleared(result) {
  for (const name of ['messageText', 'messageSearch', 'sidebarSearch', 'globalSearch', 'friendSearch']) {
    expect(result.current[name]).toBe('');
  }
  expect(result.current.groupForm).toEqual({ name: '', memberIds: [] });
  expect(result.current.authForm).toEqual({ firstName: '', lastName: '', username: '', password: '' });
  expect(result.current.groupBuilderOpen).toBe(false);
  expect(result.current.isSettingsOpen).toBe(false);
  expect(result.current.showEmojiPicker).toBe(false);
  expect(result.current.replyTarget).toBeNull();
  expect(result.current.pendingAttachments).toEqual([]);
  expect(result.current.messages).toEqual([]);
  expect(result.current.globalResults).toEqual([]);
  expect(result.current.currentUser).toBeNull();
}
