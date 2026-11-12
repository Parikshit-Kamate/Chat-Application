const mongoose = require('mongoose');

module.exports = function connectDatabase(config, chatService) {
  mongoose.connect(config.MONGO_URI, { serverSelectionTimeoutMS: 5000 }).then(() => {
    console.log('Connected to MongoDB');
    const cleanupPendingUploads = () => {
      chatService.cleanupAbandonedUploads().catch(error => {
        console.error('Unable to clean up pending uploads:', error.message);
      });
    };
    cleanupPendingUploads();
    const uploadCleanupTimer = setInterval(cleanupPendingUploads, config.UPLOAD_CLEANUP_INTERVAL_SECONDS * 1000);
    uploadCleanupTimer.unref();
  }).catch(error => {
    console.error('Error connecting to MongoDB:', error.message);
  });
};
