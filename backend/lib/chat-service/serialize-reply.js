function createSerializeReply({ serializeUser }) {
  function serializeReply(replyDoc) {
    if (!replyDoc || !replyDoc._id) {
      return null;
    }
    return {
      id: replyDoc._id.toString(),
      text: replyDoc.text || '',
      sender: replyDoc.sender ? serializeUser(replyDoc.sender) : null,
      createdAt: replyDoc.createdAt || null
    };
  }
  return serializeReply;
}

module.exports = createSerializeReply;
