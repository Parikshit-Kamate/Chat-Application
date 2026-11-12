const { normalizeObjectId } = require('../object-id');

function buildPairKey(leftUserId, rightUserId) {
  const leftId = normalizeObjectId(leftUserId);
  const rightId = normalizeObjectId(rightUserId);
  if (!leftId || !rightId) {
    throw new TypeError('Pair keys require valid user IDs.');
  }
  return [leftId, rightId].sort().join(':');
}

module.exports = buildPairKey;
