const assert = require('node:assert/strict');
const test = require('node:test');
const { withServer, requestJson } = require('./http');
const { createFriendFixture } = require('./friend-requests-fixture');

test('friend request routes create and accept pending requests', async () => {
  const {
    app,
    authHelpers,
    requesterId,
    recipientId,
    requestId,
    chatId,
    friendRequests,
    emittedEvents,
  } = await createFriendFixture();

  await withServer(app, async (server) => {
    const requesterToken = authHelpers.createJwtToken({ sub: requesterId, username: 'requester' });
    const recipientToken = authHelpers.createJwtToken({ sub: recipientId, username: 'recipient' });

    const uppercaseSelfResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/friends/requests',
      token: requesterToken,
      body: { recipientUserId: requesterId.toUpperCase() },
    });

    assert.equal(uppercaseSelfResponse.status, 400);
    assert.equal(friendRequests.length, 0);

    const createResponse = await requestJson(server, {
      method: 'POST',
      path: '/api/friends/requests',
      token: requesterToken,
      body: { recipientUserId: recipientId },
    });

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.body.request.status, 'pending');
    assert.equal(friendRequests[0].pairKey, [requesterId, recipientId].sort().join(':'));

    const acceptResponse = await requestJson(server, {
      method: 'POST',
      path: `/api/friends/requests/${requestId}/accept`,
      token: recipientToken,
      body: {},
    });

    assert.equal(acceptResponse.status, 200);
    assert.equal(acceptResponse.body.request.status, 'accepted');
    assert.equal(acceptResponse.body.chat.id, chatId);
    assert.deepEqual(
      emittedEvents.map((event) => event.eventName),
      ['friends:refresh', 'friends:refresh', 'chat:list:refresh']
    );
  });
});
