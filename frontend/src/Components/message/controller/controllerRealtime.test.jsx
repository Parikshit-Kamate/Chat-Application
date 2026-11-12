import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mocks, peer, resetControllerMocks } from './controllerTestHarness';
import { useMessageController } from '../useMessageController';

beforeEach(() => resetControllerMocks());
afterEach(cleanup);

async function openConversation() {
  const hook = renderHook(useMessageController);
  await waitFor(() => expect(hook.result.current.isChatListInitializing).toBe(false));
  await waitFor(() => expect(mocks.handlers.has('message:new')).toBe(true));
  act(() => hook.result.current.setActiveChatId('chat-a'));
  await waitFor(() => expect(mocks.api.get).toHaveBeenCalledWith(
    '/chats/chat-a/messages', expect.any(Object)
  ));
  return hook;
}

describe('message controller realtime events', () => {
  it('deduplicates active messages, acknowledges reads and clears deleted replies', async () => {
    const { result } = await openConversation();
    const incoming = { id: 'message-1', chatId: 'chat-a', sender: peer, text: 'Hello' };
    act(() => {
      mocks.handlers.get('message:new')(incoming);
      mocks.handlers.get('message:new')(incoming);
    });
    expect(result.current.messages).toEqual([incoming]);
    expect(result.current.activeChat.lastMessage).toEqual(incoming);
    expect(mocks.api.post).toHaveBeenCalledWith('/chats/chat-a/read', {}, expect.any(Object));

    act(() => {
      result.current.setReplyTarget(incoming);
      result.current.setHighlightMessageId(incoming.id);
    });
    act(() => mocks.handlers.get('message:deleted')({ messageId: incoming.id, chatId: 'chat-a' }));
    expect(result.current.messages).toEqual([]);
    expect(result.current.replyTarget).toBeNull();
    expect(result.current.highlightMessageId).toBe('');
  });

  it('updates inactive unread badges and synchronizes presence and typing labels', async () => {
    const { result } = await openConversation();
    const incoming = { id: 'message-2', chatId: 'chat-b', sender: peer, text: 'Hi elsewhere' };
    act(() => mocks.handlers.get('message:new')(incoming));
    expect(result.current.filteredChats.find((chat) => chat.id === 'chat-b').unreadCount).toBe(1);
    expect(result.current.messages).toEqual([]);
    expect(result.current.toasts.at(-1).text).toBe('Sam: Hi elsewhere');

    act(() => mocks.handlers.get('presence:update')({ userId: peer.id, isOnline: true }));
    expect(result.current.activeChatSubline).toBe('Online');
    expect(result.current.friends[0].isOnline).toBe(true);
    act(() => mocks.handlers.get('typing:update')({
      chatId: 'chat-a', userId: peer.id, username: peer.username, isTyping: true,
    }));
    expect(result.current.typingText).toBe('Sam is typing...');
    act(() => mocks.handlers.get('typing:update')({
      chatId: 'chat-a', userId: peer.id, isTyping: false,
    }));
    expect(result.current.typingText).toBe('');
  });

  it('preserves the composer payload and resets it after the send acknowledgement', async () => {
    const { result } = await openConversation();
    act(() => {
      result.current.setMessageText('  Hello Sam  ');
      result.current.setReplyTarget({ id: 'original' });
      result.current.setShowEmojiPicker(true);
    });
    act(() => result.current.handleSendMessage());
    expect(mocks.socket.emit).toHaveBeenCalledWith('message:send', expect.objectContaining({
      chatId: 'chat-a', text: 'Hello Sam', replyToId: 'original',
      attachments: [], clientMessageId: expect.any(String),
    }), expect.any(Function));
    expect(result.current.messageText).toBe('');
    expect(result.current.replyTarget).toBeNull();
    expect(result.current.showEmojiPicker).toBe(false);
  });
});
