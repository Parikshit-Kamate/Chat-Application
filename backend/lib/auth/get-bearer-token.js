function getBearerToken(authorizationHeader = '') {
  if (typeof authorizationHeader !== 'string') {
    return '';
  }
  if (!authorizationHeader.startsWith('Bearer ')) {
    return '';
  }
  return authorizationHeader.slice('Bearer '.length).trim();
}

module.exports = getBearerToken;
