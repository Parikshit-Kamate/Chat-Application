function createSerializeUserValue({ serializeUser }) {
  function serializeUserValue(user, options = null) {
    if (!user) {
      return null;
    }
    if (user.username !== undefined || user._id || user.id) {
      return serializeUser(user, options);
    }
    const serializedUser = { id: user.toString(), username: '', firstName: '', lastName: '' };
    if (options && typeof options === 'object' && options.includePresence === false) {
      return serializedUser;
    }
    return { ...serializedUser, isOnline: false, lastSeen: null };
  }
  return serializeUserValue;
}

module.exports = createSerializeUserValue;
