const mongoose = require('mongoose');
const config = require('../config');
const models = require('../runtime/models');
const { createChatService } = require('../lib/chat-service');
const { inventoryPublicAttachments } = require('./public-attachment-inventory');
const { removePublicRecords } = require('./remove-public-records');

async function main() {
  const execute = process.argv.includes('--execute');
  if (!config.CLOUDINARY_CLOUD_NAME || !config.CLOUDINARY_API_KEY || !config.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary signing credentials are required for legacy inventory and cleanup.');
  }
  await mongoose.connect(config.MONGO_URI, { serverSelectionTimeoutMS: 5000 });
  try {
    const { assets, unresolved } = await inventoryPublicAttachments(models, config.CLOUDINARY_CLOUD_NAME);
    console.log(JSON.stringify({ mode: execute ? 'delete' : 'dry-run', assets: assets.length, unresolved }));
    if (!execute) return;
    if (unresolved) throw new Error('Some legacy references have no public ID. Resolve them before deletion.');
    const service = createChatService({
      models, realtime: {}, io: {}, cloudinaryCloudName: config.CLOUDINARY_CLOUD_NAME,
      cloudinaryApiKey: config.CLOUDINARY_API_KEY, cloudinaryApiSecret: config.CLOUDINARY_API_SECRET
    });
    let deleted = 0;
    for (const asset of assets) {
      await service.destroyCloudinaryAsset({ ...asset, deliveryType: 'upload' });
      await removePublicRecords(models, service, asset);
      deleted += 1;
    }
    console.log(JSON.stringify({ deleted, invalidationRequested: true,
      note: 'CDN invalidation is asynchronous. Verify old URLs fail before considering exposure closed.' }));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

module.exports = { main };
