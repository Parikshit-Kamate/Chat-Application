export function getSessionExpiresAt(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 3) return null;
    const body = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(body));
    return Number.isSafeInteger(payload.exp) && payload.exp > 0 ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}
