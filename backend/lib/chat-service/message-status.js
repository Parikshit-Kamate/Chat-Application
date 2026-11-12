function createMessageStatus({ Message, idList, Chat, io }) {
  const markMessagesDelivered = require('./mark-messages-delivered')({ Message, idList });
  const markMessagesSeen = require('./mark-messages-seen')({ Chat, Message, idList });
  const emitStatusUpdates = require('./emit-status-updates')({ io });
  return { markMessagesDelivered, markMessagesSeen, emitStatusUpdates };
}

module.exports = createMessageStatus;
