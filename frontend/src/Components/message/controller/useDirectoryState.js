import { useState } from 'react';
import { EMPTY_MESSAGE_PAGE_INFO } from './messagePaging';

export function useDirectoryState() {
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagePageInfo, setMessagePageInfo] = useState(EMPTY_MESSAGE_PAGE_INFO);
  const [hasLoadedInitialChats, setHasLoadedInitialChats] = useState(false);

  const [groupForm, setGroupForm] = useState({ name: '', memberIds: [] });
  const [groupBuilderOpen, setGroupBuilderOpen] = useState(false);

  return {
    users, setUsers, friends, setFriends, incomingRequests, setIncomingRequests, outgoingRequests,
    setOutgoingRequests, chats, setChats, activeChatId, setActiveChatId, messages, setMessages,
    messagePageInfo, setMessagePageInfo, hasLoadedInitialChats, setHasLoadedInitialChats,
    groupForm, setGroupForm, groupBuilderOpen, setGroupBuilderOpen,
  };
}
