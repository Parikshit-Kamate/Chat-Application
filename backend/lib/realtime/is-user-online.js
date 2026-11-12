function createIsUserOnline({ getLiveSocketIdsForUser }) {
  return function isUserOnline(userId) {
    return getLiveSocketIdsForUser(userId).length > 0;
  };
}

module.exports = createIsUserOnline;
