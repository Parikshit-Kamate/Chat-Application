

export function createSearchResultAction(context) {
  const {
    setActiveChatId, setMessageSearch, setGlobalSearch, setGlobalResults, setHighlightMessageId,
    setIsSettingsOpen,
  } = context;

  const handleOpenSearchResult = (result) => {
    if (!result?.chatId) {
      return;
    }

    setActiveChatId(result.chatId);
    setMessageSearch('');
    setHighlightMessageId(result.id || '');
    setGlobalResults([]);
    setGlobalSearch('');
    setIsSettingsOpen(false);
  };

  return {
    handleOpenSearchResult,
  };
}
