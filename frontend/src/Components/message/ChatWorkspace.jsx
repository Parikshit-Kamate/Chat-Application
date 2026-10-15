import React from 'react';
import ChatPanel from './ChatPanel';
import ChatSidebar from './ChatSidebar';
import MessageContextMenu from './MessageContextMenu';
import SettingsPanel from './SettingsPanel';
import ToastStack from './ToastStack';

function ChatWorkspace(props) {
  const {
    activeChat,
    activeChatId,
    activeChatSubline,
    contextMenuMessage,
    currentUser,
    filteredChats,
    filteredFriendSearchResults,
    friends,
    friendActionKey,
    friendSearch,
    globalResults,
    globalSearch,
    groupActionKey,
    groupBuilderOpen,
    groupForm,
    handleLoadOlderMessages,
    handleAcceptFriendRequest,
    handleAddGroupMembers,
    handleComposerKeyDown,
    handleCreateGroupChat,
    handleDeleteMessage,
    handleCopyMessage,
    handleFileSelection,
    handleLeaveGroupChat,
    handleLogout,
    handleMessageInput,
    handleOpenMessageContextMenu,
    handleOpenSearchResult,
    handleRejectFriendRequest,
    handleRemoveGroupMember,
    handleRenameGroupChat,
    handleSendFriendRequest,
    handleSendMessage,
    highlightMessageId,
    incomingRequests,
    isLoadingChats,
    isChatListInitializing,
    isLoadingFriends,
    isLoadingMessages,
    isLoadingOlderMessages,
    isSearchingUsers,
    isSettingsOpen,
    messageActionKey,
    messageContextMenu,
    messageScrollerRef,
    messageSearch,
    messageText,
    messages,
    hasMoreMessages,
    pendingAttachments,
    pendingFriendRequestCount,
    replyTarget,
    setActiveChatId,
    setFriendSearch,
    setGlobalSearch,
    setGroupBuilderOpen,
    setGroupForm,
    setHighlightMessageId,
    setIsSettingsOpen,
    setMessageSearch,
    setMessageText,
    setPendingAttachments,
    setReplyTarget,
    setShowEmojiPicker,
    setSidebarSearch,
    shellClassName,
    showEmojiPicker,
    sidebarSearch,
    toasts,
    toggleGroupMember,
    typingText,
    uploading,
    users,
  } = props;

  return (
    <div className={shellClassName}>
      <div className="chat-layout">
        <ChatSidebar
          activeChat={activeChat}
          activeChatId={activeChatId}
          currentUser={currentUser}
          filteredChats={filteredChats}
          isChatListInitializing={isChatListInitializing}
          isLoadingChats={isLoadingChats}
          pendingFriendRequestCount={pendingFriendRequestCount}
          setActiveChatId={setActiveChatId}
          setIsSettingsOpen={setIsSettingsOpen}
          setSidebarSearch={setSidebarSearch}
          sidebarSearch={sidebarSearch}
        />

        <ChatPanel
          activeChat={activeChat}
          activeChatSubline={activeChatSubline}
          currentUser={currentUser}
          handleComposerKeyDown={handleComposerKeyDown}
          handleFileSelection={handleFileSelection}
          handleLoadOlderMessages={handleLoadOlderMessages}
          handleMessageInput={handleMessageInput}
          handleOpenMessageContextMenu={handleOpenMessageContextMenu}
          handleSendMessage={handleSendMessage}
          highlightMessageId={highlightMessageId}
          isChatListInitializing={isChatListInitializing}
          isLoadingMessages={isLoadingMessages}
          isLoadingOlderMessages={isLoadingOlderMessages}
          messageScrollerRef={messageScrollerRef}
          messageSearch={messageSearch}
          messageText={messageText}
          messages={messages}
          hasMoreMessages={hasMoreMessages}
          pendingAttachments={pendingAttachments}
          replyTarget={replyTarget}
          setActiveChatId={setActiveChatId}
          setHighlightMessageId={setHighlightMessageId}
          setMessageSearch={setMessageSearch}
          setMessageText={setMessageText}
          setPendingAttachments={setPendingAttachments}
          setReplyTarget={setReplyTarget}
          setShowEmojiPicker={setShowEmojiPicker}
          showEmojiPicker={showEmojiPicker}
          typingText={typingText}
          uploading={uploading}
        />
      </div>

      <MessageContextMenu
        contextMenuMessage={contextMenuMessage}
        handleCopyMessage={handleCopyMessage}
        handleDeleteMessage={handleDeleteMessage}
        messageActionKey={messageActionKey}
        messageContextMenu={messageContextMenu}
      />

      <SettingsPanel
        activeChat={activeChat}
        currentUser={currentUser}
        filteredFriendSearchResults={filteredFriendSearchResults}
        friends={friends}
        friendActionKey={friendActionKey}
        friendSearch={friendSearch}
        globalResults={globalResults}
        globalSearch={globalSearch}
        groupActionKey={groupActionKey}
        groupBuilderOpen={groupBuilderOpen}
        groupForm={groupForm}
        handleAcceptFriendRequest={handleAcceptFriendRequest}
        handleAddGroupMembers={handleAddGroupMembers}
        handleCreateGroupChat={handleCreateGroupChat}
        handleLeaveGroupChat={handleLeaveGroupChat}
        handleLogout={handleLogout}
        handleOpenSearchResult={handleOpenSearchResult}
        handleRejectFriendRequest={handleRejectFriendRequest}
        handleRemoveGroupMember={handleRemoveGroupMember}
        handleRenameGroupChat={handleRenameGroupChat}
        handleSendFriendRequest={handleSendFriendRequest}
        incomingRequests={incomingRequests}
        isLoadingFriends={isLoadingFriends}
        isSearchingUsers={isSearchingUsers}
        isSettingsOpen={isSettingsOpen}
        messageSearch={messageSearch}
        setFriendSearch={setFriendSearch}
        setGlobalSearch={setGlobalSearch}
        setGroupBuilderOpen={setGroupBuilderOpen}
        setGroupForm={setGroupForm}
        setIsSettingsOpen={setIsSettingsOpen}
        setMessageSearch={setMessageSearch}
        toggleGroupMember={toggleGroupMember}
        users={users}
      />

      <ToastStack toasts={toasts} />
    </div>
  );
}

export default ChatWorkspace;
