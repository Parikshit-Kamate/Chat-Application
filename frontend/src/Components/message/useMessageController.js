import { useControllerState } from './controller/useControllerState';
import { useControllerRefs } from './controller/useControllerRefs';
import { useApi } from './controller/useApi';
import { useToasts } from './controller/useToasts';
import { useTypingActions } from './controller/useTypingActions';
import { useDirectoryLoading } from './controller/useDirectoryLoading';
import { useChatLoading } from './controller/useChatLoading';
import { useReadReceipts } from './controller/useReadReceipts';
import { useMessageLoading } from './controller/useMessageLoading';
import { useOlderMessages } from './controller/useOlderMessages';
import { useControllerEffects } from './controller/useControllerEffects';
import { useChatView } from './controller/useChatView';
import { useMessageActions } from './controller/useMessageActions';
import { createControllerActions } from './controller/createControllerActions';
import { getControllerView } from './controller/getControllerView';

export function useMessageController() {
  // This render-local context connects the focused state, effects, and action modules.
  const context = useControllerState();
  Object.assign(context, useControllerRefs(context));
  Object.assign(context, useApi(context));
  Object.assign(context, useToasts(context));
  Object.assign(context, useTypingActions(context));
  Object.assign(context, useDirectoryLoading(context));
  Object.assign(context, useChatLoading(context));
  Object.assign(context, useReadReceipts(context));
  Object.assign(context, useMessageLoading(context));
  Object.assign(context, useOlderMessages(context));
  useControllerEffects(context);
  Object.assign(context, useChatView(context));
  Object.assign(context, createControllerActions(context));
  Object.assign(context, useMessageActions(context));

  return getControllerView(context);
}
