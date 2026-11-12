import { useEffect, useMemo, useState } from 'react';
import { createAttachmentContent } from './createAttachmentContent';

export function useAttachmentContent(attachment, access, preview) {
  const [state, setState] = useState({});
  const { uploadId, downloadUrl, resourceType } = attachment;
  const job = useMemo(() => createAttachmentContent(
    { uploadId, downloadUrl, resourceType }, access, setState
  ), [uploadId, downloadUrl, resourceType, access]);

  useEffect(() => {
    const dispose = job.start();
    if (preview) job.load();
    return dispose;
  }, [job, preview]);

  const currentState = state.job === job && access?.isCurrent() ? state : {};
  return { ...currentState, load: job.load };
}
