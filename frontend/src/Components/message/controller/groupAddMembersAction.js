

export function createGroupAddMembersAction(context) {
  const {
    api, setActiveChatId, setGroupActionKey, authHeaders, pushToast, loadChats,
  } = context;

  const handleAddGroupMembers = async (chatId, memberIds) => {
    const selectedMemberIds = Array.isArray(memberIds) ? memberIds.filter(Boolean) : [];

    if (!chatId || selectedMemberIds.length === 0) {
      pushToast('Select at least one member to add.', 'warning');
      return;
    }

    try {
      setGroupActionKey(`add-${chatId}`);
      const response = await api.post(
        `/chats/${chatId}/members`,
        {
          memberIds: selectedMemberIds,
        },
        {
          headers: authHeaders,
        }
      );

      await loadChats();
      if (response.data.chat?.id) {
        setActiveChatId(response.data.chat.id);
      }
      pushToast('Group members added.', 'success');
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to add group members.', 'danger');
    } finally {
      setGroupActionKey('');
    }
  };

  return {
    handleAddGroupMembers,
  };
}
