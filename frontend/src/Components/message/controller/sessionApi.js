function cancelled() {
  const error = new Error('This session is no longer active.');
  error.name = 'AbortError';
  error.code = 'SESSION_CHANGED';
  return error;
}

export function createSessionApi(transport, session, endSession) {
  const request = async (method, url, data, config) => {
    if (!session.isCurrent()) throw cancelled();
    const options = { ...config, signal: session.signal };
    try {
      const response = await (method === 'get' || method === 'delete'
        ? transport[method](url, options)
        : transport[method](url, data, options));
      if (!session.isCurrent()) throw cancelled();
      return response;
    } catch (error) {
      if (!session.isCurrent()) throw cancelled();
      if (session.token && error.response?.status === 401) {
        endSession({ expired: true });
        throw cancelled();
      }
      throw error;
    }
  };
  return {
    get: (url, config) => request('get', url, undefined, config),
    delete: (url, config) => request('delete', url, undefined, config),
    post: (url, data, config) => request('post', url, data, config),
    patch: (url, data, config) => request('patch', url, data, config),
  };
}
