function createRequireUploadModels({ UploadAsset, UploadQuota }) {
  function requireUploadModels() {
    if (!UploadAsset || !UploadQuota) {
      throw new Error('Upload persistence models are not configured.');
    }
  }
  return requireUploadModels;
}

module.exports = createRequireUploadModels;
