import React from 'react';
import { getAvatarInitials, getAvatarPalette, getDisplayUsername } from './messageUtils';

function UserAvatar({ user, name, className = '', showPresence = false }) {
  const label = user ? getDisplayUsername(user, name || 'User') : getDisplayUsername(name, 'User');

  return (
    <div className={`user-avatar ${className}`.trim()} style={getAvatarPalette(label)} aria-hidden="true">
      <span>{getAvatarInitials(label)}</span>
      {showPresence ? <i className={`avatar-presence ${user?.isOnline ? 'online' : ''}`} /> : null}
    </div>
  );
}

export default UserAvatar;
