

export function createFriendActions(context) {
  const {
    api, setFriendActionKey, authHeaders, pushToast, loadFriendsOverview, loadChats,
  } = context;

  const handleSendFriendRequest = async (recipientUserId) => {
    if (!recipientUserId) {
      return;
    }

    try {
      setFriendActionKey(`send-${recipientUserId}`);
      await api.post(
        '/friends/requests',
        {
          recipientUserId,
        },
        {
          headers: authHeaders,
        }
      );

      await loadFriendsOverview();
      pushToast('Friend request sent.', 'success');
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to send friend request.', 'danger');
    } finally {
      setFriendActionKey('');
    }
  };

  const handleAcceptFriendRequest = async (requestId) => {
    if (!requestId) {
      return;
    }

    try {
      setFriendActionKey(`accept-${requestId}`);
      await api.post(
        `/friends/requests/${requestId}/accept`,
        {},
        {
          headers: authHeaders,
        }
      );

      await Promise.all([loadFriendsOverview(), loadChats()]);
      pushToast('Friend request accepted.', 'success');
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to accept friend request.', 'danger');
    } finally {
      setFriendActionKey('');
    }
  };

  const handleRejectFriendRequest = async (requestId) => {
    if (!requestId) {
      return;
    }

    try {
      setFriendActionKey(`reject-${requestId}`);
      await api.post(
        `/friends/requests/${requestId}/reject`,
        {},
        {
          headers: authHeaders,
        }
      );

      await loadFriendsOverview();
      pushToast('Friend request rejected.', 'info');
    } catch (error) {
      pushToast(error.response?.data?.error || 'Unable to reject friend request.', 'danger');
    } finally {
      setFriendActionKey('');
    }
  };

  return {
    handleSendFriendRequest, handleAcceptFriendRequest, handleRejectFriendRequest,
  };
}
