function publicAssetReference(attachment, cloudName) {
  try {
    const url = new URL(attachment.secureUrl || attachment.url);
    const parts = url.pathname.split('/').filter(Boolean);
    if (url.protocol !== 'https:' || url.hostname !== 'res.cloudinary.com' ||
      parts[0] !== cloudName || parts[2] !== 'upload' ||
      !['image', 'raw', 'video'].includes(parts[1])) return null;
    return { publicId: attachment.publicId, resourceType: parts[1] };
  } catch (_error) {
    return null;
  }
}

async function inventoryPublicAttachments(models, cloudName) {
  const assets = new Map();
  let unresolved = 0;
  const add = reference => {
    if (!reference) return;
    if (!reference.publicId) { unresolved += 1; return; }
    assets.set(`${reference.resourceType}:${reference.publicId}`, reference);
  };
  const addUrls = attachment => {
    for (const url of [attachment.url, attachment.secureUrl]) {
      add(publicAssetReference({ publicId: attachment.publicId, url, secureUrl: '' }, cloudName));
    }
  };
  for await (const asset of models.UploadAsset.find({ provider: 'cloudinary' }).cursor()) {
    if (asset.deliveryType !== 'authenticated') {
      add({ publicId: asset.publicId, resourceType: asset.resourceType });
    }
    addUrls(asset);
  }
  for await (const message of models.Message.find({ 'attachments.0': { $exists: true } }).cursor()) {
    for (const attachment of message.attachments) addUrls(attachment);
  }
  return { assets: [...assets.values()], unresolved };
}

module.exports = { inventoryPublicAttachments };
