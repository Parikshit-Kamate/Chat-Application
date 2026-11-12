const { authorizeAttachment } = require('../../lib/attachment-access/authorize');
const { readAttachmentContent } = require('../../lib/attachment-access/read-content');
const { sanitizeAttachmentFileName } = require('../../lib/chat-service/sanitize-attachment-file-name');

function createDownloadFile({ models, config }) {
  return async function downloadFile(req, res) {
    res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache', Expires: '0' });
    try {
      const asset = await authorizeAttachment(models, req.params.uploadId, req.auth.sub);
      if (!asset) return res.status(404).json({ error: 'Attachment not found.' });
      if (asset.provider === 'cloudinary' && asset.deliveryType !== 'authenticated') {
        return res.status(410).json({ error: 'This older attachment requires secure storage migration.' });
      }
      const content = await readAttachmentContent(asset, config);
      if (!(await authorizeAttachment(models, req.params.uploadId, req.auth.sub))) {
        return res.status(404).json({ error: 'Attachment not found.' });
      }
      const fileName = encodeURIComponent(sanitizeAttachmentFileName(asset.fileName) || 'attachment')
        .replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
      res.set({
        'Content-Type': asset.mediaType,
        'Content-Disposition': `attachment; filename*=UTF-8''${fileName}`,
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "sandbox; default-src 'none'"
      });
      return res.send(content);
    } catch (error) {
      console.error('Protected attachment download failed:', error.message);
      return res.status(502).json({ error: 'Attachment is temporarily unavailable.' });
    }
  };
}

module.exports = createDownloadFile;
