import React from 'react';
import MessageBubble from './MessageBubble';

export default function MessageList(props) {
  const {
    messageListRef, handleMessagesScroll, hasMoreMessages = false, requestOlderMessages,
    isLoadingMessages, isLoadingOlderMessages = false, messages, trimmedMessageSearch, messageScrollerRef,
  } = props;
  return (
    <div className="chat-messages" ref={messageListRef} onScroll={handleMessagesScroll}>
      {hasMoreMessages && (
        <button
          type="button"
          className="load-older-messages"
          onClick={requestOlderMessages}
          disabled={isLoadingMessages || isLoadingOlderMessages}
        >
          {isLoadingOlderMessages ? 'Loading older messages...' : 'Load older messages'}
        </button>
      )}
    
      {isLoadingMessages && <div className="message-helper">Loading messages...</div>}
    
      {!isLoadingMessages && messages.length === 0 && (
        <div className="message-helper">
          {trimmedMessageSearch ? 'No messages match your search.' : 'No messages yet. Start the conversation.'}
        </div>
      )}
    
      {messages.map((message) => (
        <MessageBubble key={message.id} {...props} message={message} />
      ))}
    
      <div ref={messageScrollerRef} />
    </div>
  );
}
