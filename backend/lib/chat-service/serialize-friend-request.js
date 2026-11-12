function createSerializeFriendRequest({ serializeUserValue }) {
  function serializeFriendRequest(request, viewerId) {
    const userSerializationOptions = request.status === 'accepted' ? null : { includePresence: false };
    const requester = serializeUserValue(request.requester, userSerializationOptions);
    const recipient = serializeUserValue(request.recipient, userSerializationOptions);
    const otherUser = requester?.id === viewerId ? recipient : requester;
    return {
      id: request._id.toString(),
      status: request.status,
      actedAt: request.actedAt || null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      requester,
      recipient,
      user: otherUser
    };
  }
  return serializeFriendRequest;
}

module.exports = createSerializeFriendRequest;
