function createIsGroupAdmin({ idList }) {
  return function isGroupAdmin(chat, userId) {
    return idList(chat.admins || []).includes(userId);
  };
}

module.exports = createIsGroupAdmin;
