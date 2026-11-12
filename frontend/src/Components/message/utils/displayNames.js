function normalizeDisplayPart(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

export function getDisplayUsername(userOrUsername, fallback = 'User') {
  if (userOrUsername && typeof userOrUsername === 'object') {
    const fullName = [normalizeDisplayPart(userOrUsername.firstName), normalizeDisplayPart(userOrUsername.lastName)]
      .filter(Boolean)
      .join(' ');

    if (fullName) {
      return fullName;
    }

    return getDisplayUsername(userOrUsername.username, fallback);
  }

  const normalizedUsername = normalizeDisplayPart(userOrUsername);

  if (!normalizedUsername) {
    return fallback;
  }

  const atIndex = normalizedUsername.indexOf('@');
  if (atIndex > 0) {
    return normalizedUsername.slice(0, atIndex);
  }

  return normalizedUsername;
}
