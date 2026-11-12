

export function createGroupCreationActions(context) {
  const {
    api, setActiveChatId, groupForm, setGroupForm, setGroupBuilderOpen, setIsSettingsOpen,
    authHeaders, pushToast, loadChats,
  } = context;

  const toggleGroupMember = (userId) => {
    setGroupForm((prevForm) => {
      const alreadySelected = prevForm.memberIds.includes(userId);

      if (alreadySelected) {
        return {
          ...prevForm,
          memberIds: prevForm.memberIds.filter((memberId) => memberId !== userId),
        };
      }

      return {
        ...prevForm,
        memberIds: [...prevForm.memberIds, userId],
      };
    });
  };

  const handleCreateGroupChat = async () => {
    try {
      const response = await api.post(
        '/chats/group',
        {
          name: groupForm.name.trim(),
          participantIds: groupForm.memberIds,
        },
        {
          headers: authHeaders,
        }
      );

      await loadChats();
      if (response.data.chat?.id) {
        setActiveChatId(response.data.chat.id);
      }

      setGroupBuilderOpen(false);
      setGroupForm({ name: '', memberIds: [] });
      setIsSettingsOpen(false);
      pushToast('Group chat created.', 'success');
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to create group chat.', 'danger');
    }
  };

  return {
    toggleGroupMember, handleCreateGroupChat,
  };
}
