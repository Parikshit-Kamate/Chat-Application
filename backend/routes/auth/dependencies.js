const express = require('express');
const { createFixedWindowRateLimiter, getRequestIp } = require('../../lib/rate-limit');
const MAX_PASSWORD_LENGTH = 128;
const MIN_PASSWORD_LENGTH = 12;
const MAX_CONCURRENT_PASSWORD_OPERATIONS = 4;

module.exports = {
  express,
  createFixedWindowRateLimiter,
  getRequestIp,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
  MAX_CONCURRENT_PASSWORD_OPERATIONS
};
