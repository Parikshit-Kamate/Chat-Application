import React from 'react';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './Message.css';
import AuthScreen from './message/AuthScreen';
import ChatWorkspace from './message/ChatWorkspace';
import { useMessageController } from './message/useMessageController';

const Message = () => {
  const controller = useMessageController();

  if (controller.authInitializing) {
    return <div className={controller.shellClassName} aria-busy="true" />;
  }

  if (!controller.currentUser) {
    return (
      <AuthScreen
        authForm={controller.authForm}
        authLoading={controller.authLoading}
        authMode={controller.authMode}
        handleAuthSubmit={controller.handleAuthSubmit}
        setAuthForm={controller.setAuthForm}
        setAuthMode={controller.setAuthMode}
        shellClassName={controller.shellClassName}
        toasts={controller.toasts}
      />
    );
  }

  return <ChatWorkspace {...controller} />;
};

export default Message;
