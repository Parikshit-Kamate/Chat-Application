function createSerializeUser({ realtime }) {
  function serializeUser(user, options = null) {
    if (!user) {
      return null;
    }
    const id = user._id ? user._id.toString() : user.id?.toString();
    const includePresence = !options || typeof options !== 'object' || options.includePresence !== false;
    const serializedUser = {
      id,
      username: user.username || '',
      firstName: user.firstName || '',
      lastName: user.lastName || ''
    };
    if (!includePresence) {
      return serializedUser;
    }
    const resolvedIsOnline = id ? realtime.getLiveSocketIdsForUser(id).length > 0 : Boolean(user.isOnline);
    return {
      ...serializedUser,
      isOnline: resolvedIsOnline,
      lastSeen: resolvedIsOnline ? null : user.lastSeen || null
    };
  }
  return serializeUser;
}

module.exports = createSerializeUser;
