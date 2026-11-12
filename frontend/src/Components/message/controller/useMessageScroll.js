import { useEffect } from 'react';

export function useMessageScroll(context) {
  const {
    messages, highlightMessageId, setHighlightMessageId, messageScrollIntentRef,
    messageScrollerRef,
  } = context;

  useEffect(() => {
    if (!highlightMessageId) {
      return;
    }

    const timer = window.setTimeout(() => {
      setHighlightMessageId('');
    }, 2600);

    return () => {
      window.clearTimeout(timer);
    };
  }, [highlightMessageId]);

  useEffect(() => {
    if (highlightMessageId) {
      const highlightedElement = document.getElementById(`msg-${highlightMessageId}`);
      if (highlightedElement) {
        highlightedElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageScrollIntentRef.current = 'none';
        return;
      }
    }

    if (messageScrollIntentRef.current === 'bottom' && messageScrollerRef.current) {
      messageScrollerRef.current.scrollIntoView({ behavior: 'smooth' });
    }

    messageScrollIntentRef.current = 'none';
  }, [messages, highlightMessageId]);
}
