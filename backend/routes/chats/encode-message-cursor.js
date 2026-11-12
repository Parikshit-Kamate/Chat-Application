function encodeMessageCursor(message) {
  if (!message?._id || !message?.createdAt) {
    return '';
  }
  return Buffer.from(JSON.stringify({
    id: message._id.toString(),
    createdAt: new Date(message.createdAt).toISOString()
  })).toString('base64url');
}

module.exports = encodeMessageCursor;
