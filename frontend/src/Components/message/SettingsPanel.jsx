import React, { useEffect, useMemo, useState } from 'react';
import {
  getChatName,
  getDisplayUsername,
  getUserPresenceLabel,
} from './messageUtils';

function SettingsPanel({
  activeChat,
  currentUser,
  filteredFriendSearchResults,
  friends,
  friendActionKey,
  friendSearch,
  globalResults,
  globalSearch,
  groupActionKey,
  groupBuilderOpen,
  groupForm,
  handleAcceptFriendRequest,
  handleAddGroupMembers,
  handleCreateGroupChat,
  handleLeaveGroupChat,
  handleLogout,
  handleOpenSearchResult,
  handleRejectFriendRequest,
  handleRemoveGroupMember,
  handleRenameGroupChat,
  handleSendFriendRequest,
  incomingRequests,
  isLoadingFriends,
  isSearchingUsers,
  isSettingsOpen,
  messageSearch,
  setFriendSearch,
  setGlobalSearch,
  setGroupBuilderOpen,
  setGroupForm,
  setIsSettingsOpen,
  setMessageSearch,
  toggleGroupMember,
}) {
  const [groupDetailsName, setGroupDetailsName] = useState('');
  const [selectedGroupMemberIds, setSelectedGroupMemberIds] = useState([]);

  const isActiveGroup = activeChat?.type === 'group';
  const activeGroupMemberIds = useMemo(
    () => new Set((activeChat?.members || []).map((member) => member.id)),
    [activeChat?.members]
  );
  const isCurrentUserGroupAdmin = Boolean(isActiveGroup && (activeChat?.admins || []).includes(currentUser.id));
  const addableGroupFriends = useMemo(
    () => friends.filter((friend) => !activeGroupMemberIds.has(friend.id)),
    [activeGroupMemberIds, friends]
  );

  useEffect(() => {
    setGroupDetailsName(isActiveGroup ? getChatName(activeChat, currentUser.id) : '');
    setSelectedGroupMemberIds([]);
  }, [activeChat, currentUser.id, isActiveGroup]);

  const toggleSelectedGroupMember = (userId) => {
    setSelectedGroupMemberIds((prevIds) =>
      prevIds.includes(userId) ? prevIds.filter((memberId) => memberId !== userId) : [...prevIds, userId]
    );
  };

  const handleAddSelectedGroupMembers = async () => {
    await handleAddGroupMembers(activeChat.id, selectedGroupMemberIds);
    setSelectedGroupMemberIds([]);
  };

  const handleLeaveActiveGroup = () => {
    const confirmed = window.confirm(`Leave ${getChatName(activeChat, currentUser.id)}?`);
    if (confirmed) {
      handleLeaveGroupChat(activeChat.id);
    }
  };

  if (!isSettingsOpen) {
    return null;
  }

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
            <div className="sidebar-section">
              <div className="section-heading">
                <h3>Search</h3>
              </div>

              <div className="settings-search-grid">
                <div className="input-with-icon">
                  <i className="bi bi-binoculars" />
                  <input
                    type="text"
                    placeholder="Search all messages"
                    value={globalSearch}
                    onChange={(event) => setGlobalSearch(event.target.value)}
                  />
                </div>

                {activeChat && (
                  <div className="input-with-icon">
                    <i className="bi bi-search" />
                    <input
                      type="text"
                      placeholder={`Search ${getChatName(activeChat, currentUser.id)}`}
                      value={messageSearch}
                      onChange={(event) => setMessageSearch(event.target.value)}
                    />
                  </div>
                )}
              </div>

              {globalSearch.trim().length >= 2 && globalResults.length === 0 && <div className="section-helper">No results found.</div>}

              {globalResults.length > 0 && (
                <div className="global-search-results">
                  {globalResults.slice(0, 8).map((result) => (
                    <button key={result.id} type="button" onClick={() => handleOpenSearchResult(result)} className="global-result-item">
                      <strong>{getDisplayUsername(result.sender)}</strong>
                      <span>{result.text || 'Attachment'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {isActiveGroup && (
              <div className="sidebar-section group-management-section">
                <div className="section-heading">
                  <h3>Current Group</h3>
                  <span>{activeChat.members?.length || 0}</span>
                </div>

                <div className="group-name-editor">
                  <input
                    type="text"
                    value={groupDetailsName}
                    onChange={(event) => setGroupDetailsName(event.target.value)}
                    disabled={!isCurrentUserGroupAdmin}
                    aria-label="Group name"
                  />
                  {isCurrentUserGroupAdmin && (
                    <button
                      type="button"
                      onClick={() => handleRenameGroupChat(activeChat.id, groupDetailsName)}
                      disabled={groupActionKey === `rename-${activeChat.id}`}
                    >
                      {groupActionKey === `rename-${activeChat.id}` ? 'Saving...' : 'Save'}
                    </button>
                  )}
                </div>

                <div className="group-member-list">
                  {(activeChat.members || []).map((member) => {
                    const isMemberAdmin = (activeChat.admins || []).includes(member.id);
                    const isMe = member.id === currentUser.id;
                    const canRemoveMember = isCurrentUserGroupAdmin && !isMe;

                    return (
                      <div key={member.id} className="friend-row static group-member-row">
                        <div className="friend-row-main">
                          <strong>{getDisplayUsername(member)}</strong>
                          <small>{getUserPresenceLabel(member)}</small>
                        </div>
                        <div className="friend-row-actions">
                          {isMemberAdmin && <span className="friend-row-badge">Admin</span>}
                          {isMe && <span className="friend-row-badge pending">You</span>}
                          {canRemoveMember && (
                            <button
                              type="button"
                              className="friend-row-button ghost danger"
                              onClick={() => handleRemoveGroupMember(activeChat.id, member.id)}
                              disabled={groupActionKey === `remove-${member.id}`}
                            >
                              {groupActionKey === `remove-${member.id}` ? 'Removing...' : 'Remove'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {isCurrentUserGroupAdmin && (
                  <div className="group-builder compact">
                    <div className="section-heading small">
                      <h3>Add Members</h3>
                    </div>

                    {addableGroupFriends.length === 0 && <div className="section-helper">No more friends available to add.</div>}

                    {addableGroupFriends.length > 0 && (
                      <>
                        <div className="group-user-list">
                          {addableGroupFriends.map((friend) => (
                            <label key={friend.id}>
                              <input
                                type="checkbox"
                                checked={selectedGroupMemberIds.includes(friend.id)}
                                onChange={() => toggleSelectedGroupMember(friend.id)}
                              />
                              <span>{getDisplayUsername(friend)}</span>
                            </label>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={handleAddSelectedGroupMembers}
                          disabled={selectedGroupMemberIds.length === 0 || groupActionKey === `add-${activeChat.id}`}
                        >
                          {groupActionKey === `add-${activeChat.id}` ? 'Adding...' : 'Add Selected'}
                        </button>
                      </>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  className="settings-danger-btn"
                  onClick={handleLeaveActiveGroup}
                  disabled={groupActionKey === `remove-${currentUser.id}`}
                >
                  <i className="bi bi-box-arrow-right" />
                  <span>{groupActionKey === `remove-${currentUser.id}` ? 'Leaving...' : 'Leave Group'}</span>
                </button>
              </div>
            )}

            <div className="sidebar-section">
              <div className="section-heading">
                <h3>Group Chat</h3>
              </div>

              <button type="button" className="group-toggle" onClick={() => setGroupBuilderOpen((isOpen) => !isOpen)}>
                {groupBuilderOpen ? 'Close Group Builder' : 'New Group Chat'}
              </button>

              {groupBuilderOpen && (
                <div className="group-builder">
                  <input
                    type="text"
                    placeholder="Group name"
                    value={groupForm.name}
                    onChange={(event) =>
                      setGroupForm((prevForm) => ({
                        ...prevForm,
                        name: event.target.value,
                      }))
                    }
                  />

                  <div className="group-user-list">
                    {friends.map((friend) => (
                      <label key={friend.id}>
                        <input
                          type="checkbox"
                          checked={groupForm.memberIds.includes(friend.id)}
                          onChange={() => toggleGroupMember(friend.id)}
                        />
                        <span>{getDisplayUsername(friend)}</span>
                      </label>
                    ))}
                  </div>

                  {friends.length === 0 && <div className="section-helper">Add friends before creating a group.</div>}

                  <button type="button" onClick={handleCreateGroupChat}>
                    Create Group
                  </button>
                </div>
              )}
            </div>

            <div className="sidebar-section">
              <div className="section-heading">
                <h3>Add Friend</h3>
              </div>

              <div className="input-with-icon">
                <i className="bi bi-person-plus" />
                <input
                  type="text"
                  placeholder="Search usernames"
                  value={friendSearch}
                  onChange={(event) => setFriendSearch(event.target.value)}
                />
              </div>

              <div className="friend-panel-list">
                {friendSearch.trim().length > 0 && friendSearch.trim().length < 2 && (
                  <div className="section-helper">Type at least 2 characters to search.</div>
                )}

                {isSearchingUsers && <div className="section-helper">Searching users...</div>}

                {!isSearchingUsers && friendSearch.trim().length >= 2 && filteredFriendSearchResults.length === 0 && (
                  <div className="section-helper">No eligible users found.</div>
                )}

                {filteredFriendSearchResults.map((user) => (
                  <div key={user.id} className="friend-row static">
                    <div className="friend-row-main">
                      <strong>{getDisplayUsername(user)}</strong>
                      <small>{getUserPresenceLabel(user)}</small>
                    </div>
                    <button
                      type="button"
                      className="friend-row-button"
                      onClick={() => handleSendFriendRequest(user.id)}
                      disabled={friendActionKey === `send-${user.id}`}
                    >
                      {friendActionKey === `send-${user.id}` ? 'Sending...' : 'Send Request'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="sidebar-section">
              <div className="section-heading">
                <h3>Incoming Requests</h3>
                <span>{incomingRequests.length}</span>
              </div>

              <div className="friend-panel-list">
                {isLoadingFriends && <div className="section-helper">Loading requests...</div>}
                {!isLoadingFriends && incomingRequests.length === 0 && <div className="section-helper">No incoming requests.</div>}

                {incomingRequests.map((request) => (
                  <div key={request.id} className="friend-row static">
                    <div className="friend-row-main">
                      <strong>{getDisplayUsername(request.user)}</strong>
                      <small>{getUserPresenceLabel(request.user)}</small>
                    </div>
                    <div className="friend-row-actions">
                      <button
                        type="button"
                        className="friend-row-button accept"
                        onClick={() => handleAcceptFriendRequest(request.id)}
                        disabled={friendActionKey === `accept-${request.id}`}
                      >
                        {friendActionKey === `accept-${request.id}` ? 'Accepting...' : 'Accept'}
                      </button>
                      <button
                        type="button"
                        className="friend-row-button ghost"
                        onClick={() => handleRejectFriendRequest(request.id)}
                        disabled={friendActionKey === `reject-${request.id}`}
                      >
                        {friendActionKey === `reject-${request.id}` ? 'Rejecting...' : 'Reject'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPanel;
