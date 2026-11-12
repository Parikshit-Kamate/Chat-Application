const { MAX_AUTH_TIMER_DELAY_MS } = require('./constants');

function createAuthenticationExpiry(socket) {
  let timer = null;
  let disconnectStarted = false;

  function isExpired() {
    return !Number.isFinite(socket.data.authExpiresAtMs) || Date.now() >= socket.data.authExpiresAtMs;
  }

  function clear() {
    disconnectStarted = true;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function disconnect() {
    if (disconnectStarted) {
      return;
    }

    clear();
    socket.data.activeChatId = null;
    if (typeof socket.disconnect === 'function') {
      socket.disconnect(true);
    }
  }

  function schedule() {
    if (timer) {
      clearTimeout(timer);
    }

    const remainingMs = socket.data.authExpiresAtMs - Date.now();
    if (remainingMs <= 0) {
      disconnect();
      return;
    }

    timer = setTimeout(() => {
      timer = null;
      schedule();
    }, Math.min(remainingMs, MAX_AUTH_TIMER_DELAY_MS));
    timer.unref?.();
  }

  return { clear, disconnect, isExpired, schedule };
}

module.exports = { createAuthenticationExpiry };
