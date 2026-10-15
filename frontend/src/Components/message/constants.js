const env = import.meta.env || {};
const defaultBackendUrl = env.DEV
  ? 'http://localhost:8000'
  : String(globalThis.location?.origin || '');

export const SOCKET_URL = (env.VITE_SOCKET_URL || defaultBackendUrl).replace(/\/$/, '');
export const API_URL = (env.VITE_API_URL || SOCKET_URL).replace(/\/$/, '');
export const TOKEN_KEY = 'confabulate-token';

export const EMOJI_SET = [
  '\u{1F600}',
  '\u{1F602}',
  '\u{1F609}',
  '\u{1F60D}',
  '\u{1F60E}',
  '\u{1F91D}',
  '\u{1F64F}',
  '\u{1F389}',
  '\u{1F525}',
  '\u{1F4A1}',
  '\u{2705}',
  '\u{1F4AC}',
  '\u{1F680}',
  '\u{1F916}',
  '\u{1F4CE}',
  '\u{2764}\u{FE0F}',
];
