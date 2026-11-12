import { getDisplayUsername } from './displayNames';

function hashText(value) {
  return Array.from(String(value || 'user')).reduce((accumulator, character) => accumulator * 31 + character.charCodeAt(0), 7);
}

export function getAvatarInitials(username, fallback = 'U') {
  const label = getDisplayUsername(username, fallback).replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
  const parts = label.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return fallback.slice(0, 1).toUpperCase();
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function getAvatarPalette(username) {
  const palettes = [
    { start: '#ccfbf1', end: '#14b8a6', text: '#042f2e' },
    { start: '#dbeafe', end: '#3b82f6', text: '#172554' },
    { start: '#fde68a', end: '#f97316', text: '#431407' },
    { start: '#fce7f3', end: '#ec4899', text: '#500724' },
    { start: '#e0e7ff', end: '#6366f1', text: '#1e1b4b' },
    { start: '#dcfce7', end: '#22c55e', text: '#052e16' },
    { start: '#cffafe', end: '#06b6d4', text: '#083344' },
  ];
  const palette = palettes[Math.abs(hashText(getDisplayUsername(username, 'user'))) % palettes.length];

  return {
    '--avatar-start': palette.start,
    '--avatar-end': palette.end,
    '--avatar-text': palette.text,
  };
}
