import { useEffect, useMemo, useState } from 'react';
import { getChatName } from '../messageUtils';

export default function useGroupDetails({ activeChat, currentUser, friends, handleAddGroupMembers, handleLeaveGroupChat }) {
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

  return {
    groupDetailsName, setGroupDetailsName, selectedGroupMemberIds, isActiveGroup,
    isCurrentUserGroupAdmin, addableGroupFriends, toggleSelectedGroupMember,
    handleAddSelectedGroupMembers, handleLeaveActiveGroup,
  };
}
