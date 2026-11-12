import { useEffect, useMemo } from 'react';
import { createControllerRefs } from './createControllerRefs';

export function useControllerRefs(context) {
  const {
    currentUser, activeChatId, messageSearch, pendingAttachments, session,
  } = context;

  // Old async callbacks retain their own refs instead of touching the next session.
  const refs = useMemo(() => createControllerRefs(context), [session]);
  const {
    activeChatIdRef, currentUserRef, messageSearchRef, pendingClientMessageIdRef,
    pendingAttachmentCountRef,
  } = refs;

  useEffect(() => {
    pendingAttachmentCountRef.current = pendingAttachments.length;
  }, [pendingAttachmentCountRef, pendingAttachments.length]);

  useEffect(() => {
    activeChatIdRef.current = activeChatId;
    pendingClientMessageIdRef.current = '';
  }, [activeChatIdRef, activeChatId, pendingClientMessageIdRef]);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUserRef, currentUser]);

  useEffect(() => {
    messageSearchRef.current = messageSearch;
  }, [messageSearchRef, messageSearch]);

  return refs;
}
