import React from 'react';
import ChatPanel from './ChatPanel';
import ChatSidebar from './ChatSidebar';
import MessageContextMenu from './MessageContextMenu';
import SettingsPanel from './SettingsPanel';
import ToastStack from './ToastStack';

export default function ChatWorkspace({ shellClassName, toasts, ...controller }) {
  return (
    <div className={shellClassName}>
      <div className="chat-layout">
        <ChatSidebar {...controller} />
        <ChatPanel {...controller} />
      </div>
      <MessageContextMenu {...controller} />
      <SettingsPanel {...controller} />
      <ToastStack toasts={toasts} />
    </div>
  );
}
