import { useContextMenuEffect } from './useContextMenuEffect';
import { useSessionEffect } from './useSessionEffect';
import { useSessionExpiry } from './useSessionExpiry';
import { useDirectoryEffect } from './useDirectoryEffect';
import { useFriendSearch } from './useFriendSearch';
import { useSocketConnection } from './useSocketConnection';
import { useActiveChatEffect } from './useActiveChatEffect';
import { useMessageScroll } from './useMessageScroll';
import { useGlobalSearch } from './useGlobalSearch';
import { useVisibilityEffect } from './useVisibilityEffect';

export function useControllerEffects(context) {
  useContextMenuEffect(context);
  useSessionEffect(context);
  useSessionExpiry(context);
  useDirectoryEffect(context);
  useFriendSearch(context);
  useSocketConnection(context);
  useActiveChatEffect(context);
  useMessageScroll(context);
  useGlobalSearch(context);
  useVisibilityEffect(context);
}
