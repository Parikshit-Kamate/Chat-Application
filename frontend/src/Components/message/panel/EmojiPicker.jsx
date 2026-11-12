import React from 'react';
import { EMOJI_SET } from '../constants';

export default function EmojiPicker({ setMessageText }) {

  return (
    <div className="emoji-picker">
      {EMOJI_SET.map((emoji) => (
        <button key={emoji} type="button" onClick={() => setMessageText((previousText) => `${previousText}${emoji}`)}>
          {emoji}
        </button>
      ))}
    </div>
  );
}
