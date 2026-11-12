const assert = require('node:assert/strict');
const test = require('node:test');
const { withServer, requestJson } = require('./http');
const { createGroupFixture } = require('./group-chat-fixture');

test('chat routes serialize group mutations and mark unread messages as read', async () => {
  const {
    app,
    authHelpers,
    creatorId,
    memberId,
    secondMemberId,
    addedMemberId,
    chatId,
    messageId,
    emittedUserEvents,
    emittedStatusUpdates,
    evictedUserSockets,
    exclusiveChatOperations,
    state,
  } = await createGroupFixture();

  await withServer(app, async (server) => {
    const token = authHelpers.createJwtToken({ sub: creatorId, username: 'creator' });

    const duplicateMemberResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/chats/group',
      token,
      body: {
        name: 'Invalid Duplicate Group',
        participantIds: [memberId, memberId.toUpperCase()],
      },
    });

    assert.equal(duplicateMemberResponse.status, 400);
    assert.equal(state.createdChat, null);

    const createResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/chats/group',
      token,
      body: {
        name: 'Project Team',
        participantIds: [memberId, secondMemberId],
      },
    });

    assert.equal(createResponse.status, 201);
    assert.equal(state.createdChat.type, 'group');
    assert.equal(state.createdChat.members.length, 3);
    assert.deepEqual(state.createdChat.admins, [creatorId]);

    const updateResponse = await requestJson(server, {
      method: 'PATCH',
      path: `/api/chats/${chatId}`,
      token,
      body: { name: 'Renamed Team' },
    });

    assert.equal(updateResponse.status, 200);
    assert.equal(state.createdChat.name, 'Renamed Team');

    const addResponse = await requestJson(server, {
      method: 'POST',
      path: `/api/chats/${chatId}/members`,
      token,
      body: { memberIds: [addedMemberId] },
    });

    assert.equal(addResponse.status, 201);
    assert.deepEqual(addResponse.body.addedMemberIds, [addedMemberId]);
    assert.equal(state.createdChat.members.some((member) => member.user.toString() === addedMemberId), true);

    const readResponse = await requestJson(server, {
      method: 'POST',
      path: `/api/chats/${chatId}/read`,
      token,
      body: {},
    });

    assert.equal(readResponse.status, 200);
    assert.equal(readResponse.body.seenCount, 1);
    assert.equal(emittedStatusUpdates[0].updates[0].messageId, messageId);
    assert.equal(emittedUserEvents.at(-1).eventName, 'chat:list:refresh');

    const removeResponse = await requestJson(server, {
      method: 'DELETE',
      path: `/api/chats/${chatId}/members/${memberId}`,
      token,
    });

    assert.equal(removeResponse.status, 200);
    assert.equal(removeResponse.body.removedMemberId, memberId);
    assert.deepEqual(evictedUserSockets, [{ userId: memberId, chatId }]);
    assert.deepEqual(exclusiveChatOperations, [chatId, chatId, chatId]);
  });
});
