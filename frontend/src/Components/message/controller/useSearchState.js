import { useState } from 'react';

export function useSearchState() {
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [globalResults, setGlobalResults] = useState([]);
  const [highlightMessageId, setHighlightMessageId] = useState('');
  const [friendSearch, setFriendSearch] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState([]);

  return {
    sidebarSearch, setSidebarSearch, messageSearch, setMessageSearch, globalSearch,
    setGlobalSearch, globalResults, setGlobalResults, highlightMessageId, setHighlightMessageId,
    friendSearch, setFriendSearch, friendSearchResults, setFriendSearchResults,
  };
}
