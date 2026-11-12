import { useState } from 'react';

export function useComposerState() {
  const [messageText, setMessageText] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  return {
    messageText, setMessageText, replyTarget, setReplyTarget, showEmojiPicker, setShowEmojiPicker,
    pendingAttachments, setPendingAttachments, uploading, setUploading, typingUsers,
    setTypingUsers,
  };
}
