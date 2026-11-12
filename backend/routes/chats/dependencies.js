const express = require('express');
const mongoose = require('mongoose');
const { createFixedWindowRateLimiter } = require('../../lib/rate-limit');
const { normalizeObjectId } = require('../../lib/object-id');
const MAX_GROUP_MEMBERS = 50;
const MAX_MESSAGE_QUERY_LENGTH = 200;
const MAX_CURSOR_LENGTH = 512;

module.exports = {
  express,
  mongoose,
  createFixedWindowRateLimiter,
  normalizeObjectId,
  MAX_GROUP_MEMBERS,
  MAX_MESSAGE_QUERY_LENGTH,
  MAX_CURSOR_LENGTH
};
