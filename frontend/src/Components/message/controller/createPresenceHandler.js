export function createPresenceHandler(context) {
  const {
    setUsers, setFriends, setIncomingRequests, setOutgoingRequests, setChats,
    setFriendSearchResults,
  } = context;

  const handlePresenceUpdate = (presence) => {
    const { userId, isOnline, lastSeen } = presence;
    const syncPresence = (user) =>
      user.id === userId
        ? {
            ...user,
            isOnline,
            lastSeen,
          }
        : user;
    const syncRequestPresence = (request) => ({
      ...request,
      user: request.user?.id === userId ? syncPresence(request.user) : request.user,
      requester: request.requester?.id === userId ? syncPresence(request.requester) : request.requester,
      recipient: request.recipient?.id === userId ? syncPresence(request.recipient) : request.recipient,
    });

    setUsers((prevUsers) => prevUsers.map(syncPresence));
    setFriendSearchResults((prevUsers) => prevUsers.map(syncPresence));
    setFriends((prevFriends) => prevFriends.map(syncPresence));
    setIncomingRequests((prevRequests) => prevRequests.map(syncRequestPresence));
    setOutgoingRequests((prevRequests) => prevRequests.map(syncRequestPresence));

    setChats((prevChats) =>
      prevChats.map((chat) => ({
        ...chat,
        members: (chat.members || []).map((member) =>
          member.id === userId
            ? {
                ...member,
                isOnline,
                lastSeen,
              }
            : member
        ),
      }))
    );
  };

  return handlePresenceUpdate;
}
