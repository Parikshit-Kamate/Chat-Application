import { formatRelativeTime } from './timestamps';

export function getUserPresenceLabel(user) {
  if (!user) {
    return 'Last seen recently';
  }

  if (user.isOnline) {
    return 'Online';
  }

  return user.lastSeen ? `Last seen ${formatRelativeTime(user.lastSeen)}` : 'Last seen recently';
}
