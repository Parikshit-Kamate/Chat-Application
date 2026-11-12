function createDeleteTrackedUploadAsset({ destroyCloudinaryAsset, releaseUploadQuota, UploadAsset }) {
  async function deleteTrackedUploadAsset(asset, { now = new Date() } = {}) {
    if (!asset?._id || asset.status !== 'deleting') {
      return false;
    }
    if (asset.provider === 'cloudinary') {
      await destroyCloudinaryAsset({
        publicId: asset.publicId,
        resourceType: asset.resourceType,
        deliveryType: asset.deliveryType || 'upload'
      });
    }
    await releaseUploadQuota({
      ownerId: asset.owner.toString(),
      bytes: asset.bytes,
      reservationId: asset._id.toString()
    });
    const deletionResult = await UploadAsset.deleteOne({ _id: asset._id, status: 'deleting' });
    return deletionResult.deletedCount === 1;
  }
  return deleteTrackedUploadAsset;
}

module.exports = createDeleteTrackedUploadAsset;
