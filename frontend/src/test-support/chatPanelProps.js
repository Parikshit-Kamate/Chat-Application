import { vi } from 'vitest';

export function chatPanelProps(overrides = {}) {
  const currentUser = { id: 'me', username: 'Me' };
  const peer = { id: 'peer', username: 'Peer' };
  return {
    activeChat: { id: 'chat', type: 'direct', members: [currentUser, peer] },
    activeChatSubline: 'Offline',
    currentUser,
    messages: [],
    messageText: '',
    messageSearch: '',
    messageScrollerRef: { current: null },
    pendingAttachments: [],
    handleLoadOlderMessages: vi.fn(),
    handleComposerKeyDown: vi.fn(),
    handleFileSelection: vi.fn(),
    handleMessageInput: vi.fn(),
    handleOpenMessageContextMenu: vi.fn(),
    handleSendMessage: vi.fn(),
    setActiveChatId: vi.fn(),
    setHighlightMessageId: vi.fn(),
    setMessageSearch: vi.fn(),
    setMessageText: vi.fn(),
    setPendingAttachments: vi.fn(),
    setReplyTarget: vi.fn(),
    setShowEmojiPicker: vi.fn(),
    ...overrides,
  };
}
