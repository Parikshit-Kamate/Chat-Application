const net = require('net');
const isProduction = process.env.NODE_ENV === 'production';

function parseIntegerSetting(name, rawValue, { defaultValue, min, max }) {
  const value = rawValue === undefined || rawValue === '' ? defaultValue : Number(rawValue);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}.`);
  }
  return value;
}

function parseClientOrigin(value) {
  const rawOrigin = String(value || '').trim();
  if (!rawOrigin) {
    return ['http://localhost:5173', 'http://127.0.0.1:5173'];
  }
  if (rawOrigin === '*') {
    return '*';
  }
  return rawOrigin.split(',').map(origin => origin.trim()).filter(Boolean);
}

function parseHost(value) {
  const host = String(value || '').trim();
  if (!host) {
    return isProduction ? '0.0.0.0' : '127.0.0.1';
  }
  if (host === 'localhost' || net.isIP(host)) {
    return host;
  }
  throw new Error('HOST must be localhost or a valid IPv4/IPv6 address.');
}

module.exports = { parseIntegerSetting, parseClientOrigin, parseHost };
