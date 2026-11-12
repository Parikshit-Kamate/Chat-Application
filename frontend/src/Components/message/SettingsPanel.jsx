import React from 'react';
import { getDisplayUsername } from './messageUtils';
import SearchSettings from './settings/SearchSettings';
import GroupBuilder from './settings/GroupBuilder';
import FriendSearch from './settings/FriendSearch';
import IncomingRequests from './settings/IncomingRequests';
import GroupManagement from './settings/GroupManagement';
import useGroupDetails from './settings/useGroupDetails';

export default function SettingsPanel(props) {
  const { isSettingsOpen, setIsSettingsOpen, currentUser, handleLogout } = props;
  const groupDetails = useGroupDetails(props);
  const { isActiveGroup } = groupDetails;
  if (!isSettingsOpen) return null;
  return (
    <div className="settings-overlay" onClick={() => setIsSettingsOpen(false)}>
      <div className="settings-panel" onClick={(event) => event.stopPropagation()}>
        <header className="settings-panel-header">
          <div>
            <h3>Settings</h3>
            <p>Send friend requests and create group chats here.</p>
          </div>
          <button type="button" className="settings-close" onClick={() => setIsSettingsOpen(false)} aria-label="Close settings">
            <i className="bi bi-x-lg" />
          </button>
        </header>

        <div className="settings-panel-body">
          <section className="settings-account-card" aria-label="Account settings">
            <div className="settings-account-copy">
              <strong>{getDisplayUsername(currentUser)}</strong>
              <span>Signed in to this chat account</span>
            </div>
            <button type="button" className="settings-logout-btn" onClick={handleLogout}>
              <i className="bi bi-box-arrow-right" />
              <span>Logout</span>
            </button>
          </section>

          <div className="settings-section-grid">
            <SearchSettings {...props} />

            {isActiveGroup && (
              <GroupManagement {...props} {...groupDetails} />
            )}

            <GroupBuilder {...props} />

            <FriendSearch {...props} />

            <IncomingRequests {...props} />

          </div>
        </div>
      </div>
    </div>
  );
}
