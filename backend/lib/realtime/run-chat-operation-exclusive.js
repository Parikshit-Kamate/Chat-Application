function createRunChatOperationExclusive({ chatOperationQueues }) {
  return function runChatOperationExclusive(chatId, operation) {
    const normalizedChatId = String(chatId || '');
    if (!normalizedChatId || typeof operation !== 'function') {
      return Promise.reject(new TypeError('A chat ID and operation are required.'));
    }
    const previousOperation = chatOperationQueues.get(normalizedChatId) || Promise.resolve();
    const currentOperation = previousOperation.catch(() => {}).then(operation);
    chatOperationQueues.set(normalizedChatId, currentOperation);
    return currentOperation.finally(() => {
      if (chatOperationQueues.get(normalizedChatId) === currentOperation) {
        chatOperationQueues.delete(normalizedChatId);
      }
    });
  };
}

module.exports = createRunChatOperationExclusive;
