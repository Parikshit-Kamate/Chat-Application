import React from 'react';
import ChatHeader from './panel/ChatHeader';
import MessageList from './panel/MessageList';
import MessageComposer from './panel/MessageComposer';
import useChatPanelState from './panel/useChatPanelState';

export default function ChatPanel(props) {
  const { activeChat, isChatListInitializing } = props;
  const panelState = useChatPanelState(props);
  const isGroupChat = activeChat?.type === 'group';
  return (
    <section className={`chat-panel ${activeChat ? 'mobile-visible' : ''} ${isGroupChat ? 'group-chat-panel' : ''}`}>
      {!activeChat && !isChatListInitializing && (
        <div className="empty-panel">
          <strong>Select a conversation</strong>
          <span>Your chats appear on the left. Friend requests, groups, and search tools are available in Settings.</span>
        </div>
      )}
      {activeChat && (
        <>
          <ChatHeader {...props} {...panelState} />
          <MessageList {...props} {...panelState} />
          <MessageComposer {...props} />
        </>
      )}
    </section>
  );
}
