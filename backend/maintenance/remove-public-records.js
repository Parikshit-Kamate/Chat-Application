async function removePublicRecords(models, service, asset) {
  const records = await models.UploadAsset.find({
    provider: 'cloudinary', publicId: asset.publicId, resourceType: asset.resourceType,
    deliveryType: { $ne: 'authenticated' }
  });
  for (const record of records) {
    await service.releaseUploadQuota({
      ownerId: record.owner.toString(), bytes: record.bytes,
      reservationId: record._id.toString()
    });
    await models.UploadAsset.deleteOne({ _id: record._id, deliveryType: { $ne: 'authenticated' } });
  }
}

module.exports = { removePublicRecords };
