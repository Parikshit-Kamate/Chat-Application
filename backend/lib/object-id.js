function normalizeObjectId(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  return /^[a-f0-9]{24}$/.test(normalizedValue) ? normalizedValue : '';
}

module.exports = {
  normalizeObjectId,
};
