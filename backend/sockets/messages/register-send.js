const { validateDraft } = require('./validate-draft');
const { sendMessage } = require('./send-message');

function registerSendMessageEvent(context, registerEvent) {
  const { serializeMessage } = context.chatService;
  registerEvent('message:send', async (payload = {}, callback = () => {}) => {
    let persistedMessage = null;
    try {
      const draft = validateDraft(payload);
      if (draft.error) {
        callback(draft);
        return;
      }
      const result = await sendMessage(context, draft, (message) => {
        persistedMessage = message;
      });
      callback(result);
    } catch (error) {
      console.error('message:send error:', error);
      if (persistedMessage) {
        callback({
          ok: true,
          persisted: true,
          message: serializeMessage(persistedMessage),
        });
        return;
      }
      callback({ error: 'Unable to send message.' });
    }
  });
}

module.exports = { registerSendMessageEvent };
