function getUserDisplayName(user) {
  const fullName = [user?.firstName, user?.lastName].map(value => String(value || '').trim()).filter(Boolean).join(' ');
  return fullName || user?.username || '';
}

module.exports = getUserDisplayName;
