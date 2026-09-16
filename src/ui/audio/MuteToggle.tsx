import { useState } from 'react';
import { useT } from '../useT';
import { isMuted, playSfx, setMuted } from './sfx';

/** Small corner toggle for the placeholder chiptune audio (`sfx.ts`), mirroring
 * `LangToggle`'s spot on the stage. Mute state lives in `sfx.ts`, not the game store —
 * it's a player preference about this browser tab, not part of a run, so it doesn't
 * belong in the autosave (`store/gameStore.ts`'s `SavedGame`). */
export function MuteToggle() {
  const t = useT();
  const [muted, setMutedState] = useState(() => isMuted());

  const toggle = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
    if (!next) playSfx('blip');
  };

  return (
    <button
      type="button"
      className="pixel-button mute-toggle"
      onClick={toggle}
      aria-label={t(muted ? 'audio.unmute' : 'audio.mute')}
    >
      {t(muted ? 'audio.muted' : 'audio.unmuted')}
    </button>
  );
}
