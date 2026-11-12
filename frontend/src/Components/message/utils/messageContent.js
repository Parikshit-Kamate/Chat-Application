export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export function isImageAttachment(attachment) {
  if (!attachment) {
    return false;
  }

  if (attachment.resourceType === 'image') {
    return true;
  }

  const url = attachment.secureUrl || attachment.url || '';
  return url.startsWith('data:image/');
}

export function getCopyableMessageContent(message) {
  if (!message) {
    return '';
  }

  if (String(message.text || '').trim()) {
    return message.text.trim();
  }

  return (message.attachments || [])
    .map((attachment) => attachment?.secureUrl || attachment?.url || attachment?.fileName || '')
    .filter(Boolean)
    .join('\n');
}
