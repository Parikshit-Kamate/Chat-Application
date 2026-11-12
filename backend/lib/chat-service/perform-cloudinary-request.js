const { createCodedError } = require('./create-coded-error');

function createPerformCloudinaryRequest({ cloudinaryApiKey, createCloudinarySignature }) {
  async function performCloudinaryRequest(endpoint, signedParameters, extraParameters = {}) {
    const payload = new URLSearchParams();
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), 15_000);
    Object.entries({ ...signedParameters, ...extraParameters }).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        payload.append(key, String(value));
      }
    });
    payload.append('api_key', cloudinaryApiKey);
    payload.append('signature', createCloudinarySignature(signedParameters));
    try {
      const response = await fetch(endpoint, { method: 'POST', body: payload, signal: abortController.signal });
      const result = await response.json();
      if (!response.ok) {
        console.error('Cloudinary request rejected:', result?.error?.message || response.statusText);
        throw createCodedError('Cloudinary request failed.', 'CLOUDINARY_REQUEST_REJECTED');
      }
      return result;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('Cloudinary request timed out.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  return performCloudinaryRequest;
}

module.exports = createPerformCloudinaryRequest;
