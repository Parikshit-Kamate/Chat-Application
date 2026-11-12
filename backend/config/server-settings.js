const { parseIntegerSetting, parseClientOrigin, parseHost } = require('./parsers');
const isProduction = process.env.NODE_ENV === 'production';
const clientOrigin = parseClientOrigin(process.env.CLIENT_ORIGIN);
const port = parseIntegerSetting('PORT', process.env.PORT, { defaultValue: 8000, min: 1, max: 65_535 });
const host = parseHost(process.env.HOST);
const allowDataUrlUploadFallback = process.env.ALLOW_DATA_URL_UPLOAD_FALLBACK === 'true';
const configuredMongoUri = String(process.env.MONGO_URI || '').trim();
if (isProduction && clientOrigin === '*') {
  throw new Error('CLIENT_ORIGIN cannot be "*" when NODE_ENV=production.');
}
if (isProduction && allowDataUrlUploadFallback) {
  throw new Error('ALLOW_DATA_URL_UPLOAD_FALLBACK cannot be enabled in production.');
}
if (isProduction && !configuredMongoUri) {
  throw new Error('MONGO_URI is required when NODE_ENV=production.');
}

module.exports = {
  IS_PRODUCTION: isProduction,
  HOST: host,
  PORT: port,
  MONGO_URI: configuredMongoUri || 'mongodb://127.0.0.1:27017/conversation',
  CLIENT_ORIGIN: clientOrigin,
  ALLOW_DATA_URL_UPLOAD_FALLBACK: allowDataUrlUploadFallback
};
