const express = require('express');
const { createFixedWindowRateLimiter } = require('../../lib/rate-limit');
const { normalizeObjectId } = require('../../lib/object-id');
const MAX_SEARCHABLE_CHATS = 500;
const MAX_CONCURRENT_ATTACHMENT_CLEANUPS = 2;
const MAX_QUEUED_ATTACHMENT_CLEANUPS = 100;

module.exports = {
  express,
  createFixedWindowRateLimiter,
  normalizeObjectId,
  MAX_SEARCHABLE_CHATS,
  MAX_CONCURRENT_ATTACHMENT_CLEANUPS,
  MAX_QUEUED_ATTACHMENT_CLEANUPS
};
