function createUploadQuota({ requireUploadModels, resolvedUploadLimits, getUtcDayStart, UploadQuota }) {
  const reserveUploadQuota = require('./reserve-upload-quota')({
    requireUploadModels,
    resolvedUploadLimits,
    getUtcDayStart,
    UploadQuota
  });
  const releaseUploadQuota = require('./release-upload-quota')({ UploadQuota });
  return { reserveUploadQuota, releaseUploadQuota };
}

module.exports = createUploadQuota;
