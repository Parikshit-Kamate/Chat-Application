const { normalizeObjectId, mongoose } = require('./dependencies');

function decodeMessageCursor(rawCursor) {
  const cursor = String(rawCursor || '').trim();
  if (!cursor) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const createdAt = new Date(payload.createdAt);
    const id = normalizeObjectId(payload.id);
    if (Number.isNaN(createdAt.getTime()) || !id) {
      return null;
    }
    return { createdAt, id: new mongoose.Types.ObjectId(id) };
  } catch (_error) {
    return null;
  }
}

module.exports = decodeMessageCursor;
