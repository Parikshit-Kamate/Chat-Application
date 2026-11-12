

export function createGroupRemoveMemberActions(context) {
  const {
    api, setActiveChatId, setGroupActionKey, activeChatIdRef, currentUserRef, authHeaders,
    pushToast, loadChats,
  } = context;

  const handleRemoveGroupMember = async (chatId, memberId) => {
    if (!chatId || !memberId) {
      return;
    }

    try {
      setGroupActionKey(`remove-${memberId}`);
      const response = await api.delete(`/chats/${chatId}/members/${memberId}`, {
        headers: authHeaders,
      });

      await loadChats();

      if (response.data.chat?.id) {
        setActiveChatId(response.data.chat.id);
      } else if (activeChatIdRef.current === chatId) {
        setActiveChatId(null);
      }

      pushToast(memberId === currentUserRef.current?.id ? 'You left the group.' : 'Group member removed.', 'success');
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to update group members.', 'danger');
    } finally {
      setGroupActionKey('');
    }
  };

  const handleLeaveGroupChat = async (chatId) => {
    await handleRemoveGroupMember(chatId, currentUserRef.current?.id);
  };

  return {
    handleRemoveGroupMember, handleLeaveGroupChat,
  };
}
