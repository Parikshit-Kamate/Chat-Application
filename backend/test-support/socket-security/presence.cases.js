const assert = require('node:assert/strict');
const test = require('node:test');
const { createSocketHarness } = require('./harness');

test('presence updates are scoped to current chat co-members', async () => {
  const harness = createSocketHarness();
  await harness.connect();

  assert.deepEqual(harness.presenceEvents[0].userIds, [harness.peerId]);
  assert.equal(harness.presenceEvents[0].eventName, 'presence:update');
  assert.equal(harness.presenceEvents[0].payload.isOnline, true);
  assert.equal(harness.presenceEvents[0].userIds.includes(harness.outsiderId), false);
  assert.equal(
    harness.roomEvents.some((event) => event.room === null && event.eventName === 'presence:update'),
    false
  );

  await harness.socketHandlers.disconnect('client namespace disconnect');

  assert.deepEqual(harness.presenceEvents[1].userIds, [harness.peerId]);
  assert.equal(harness.presenceEvents[1].payload.isOnline, false);
});
