import { requestAttachment } from './attachmentRequest';

export function createAttachmentContent(attachment, access, publish) {
  let controller = new AbortController();
  let active = false;
  let generation = 0;
  let pending = null;
  let url = '';
  const isCurrent = () => active && access?.isCurrent() && !access.signal?.aborted;
  const job = {
    load() {
      if (!isCurrent()) return Promise.resolve('');
      if (url) return Promise.resolve(url);
      if (pending) return pending;
      const request = controller;
      const requestGeneration = generation;
      const canPublish = () => isCurrent() && generation === requestGeneration && !request.signal.aborted;
      publish({ job, loading: true });
      pending = requestAttachment(attachment, access, request.signal)
        .then((blob) => {
          if (!canPublish()) return '';
          url = URL.createObjectURL(blob);
          publish({ job, url, loading: false });
          return url;
        })
        .catch((error) => {
          if (canPublish() && error.name !== 'AbortError') {
            publish({ job, error: true, loading: false });
          }
          return '';
        })
        .finally(() => { if (generation === requestGeneration) pending = null; });
      return pending;
    },
    dispose() {
      active = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
      url = '';
    },
    start() {
      active = true;
      generation += 1;
      controller = new AbortController();
      pending = null;
      publish({ job, loading: false });
      access?.signal?.addEventListener('abort', job.dispose, { once: true });
      if (access?.signal?.aborted) job.dispose();
      return () => {
        access?.signal?.removeEventListener('abort', job.dispose);
        job.dispose();
      };
    },
  };
  return job;
}
