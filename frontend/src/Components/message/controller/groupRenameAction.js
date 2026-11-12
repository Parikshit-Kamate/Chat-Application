

export function createGroupRenameAction(context) {
  const {
    api, setActiveChatId, setGroupActionKey, authHeaders, pushToast, loadChats,
  } = context;

  const handleRenameGroupChat = async (chatId, name) => {
    const nextName = String(name || '').trim();

    if (!chatId || !nextName) {
      pushToast('Group name is required.', 'warning');
      return;
    }

    try {
      setGroupActionKey(`rename-${chatId}`);
      const response = await api.patch(
        `/chats/${chatId}`,
        {
          name: nextName,
        },
        {
          headers: authHeaders,
        }
      );

      await loadChats();
      if (response.data.chat?.id) {
        setActiveChatId(response.data.chat.id);
      }
      pushToast('Group name updated.', 'success');
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to update group.', 'danger');
    } finally {
      setGroupActionKey('');
    }
  };

  return {
    handleRenameGroupChat,
  };
}
