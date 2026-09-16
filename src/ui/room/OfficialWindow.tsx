import { getCharacter, displayName } from '@/data/characters';
import { useGameStore } from '@/store/gameStore';
import { useT } from '../useT';

/** Top-left info box (GAME_PLAN §11): the active official's portrait and name. */
export function OfficialWindow() {
  const t = useT();
  const activeCharacter = useGameStore((s) => s.activeCharacter);
  const character = getCharacter(activeCharacter);

  return (
    <div className="official-window" aria-label={t('room.official.label')}>
      <img className="official-portrait" src={character.sprite.front} alt="" aria-hidden="true" />
      <span className="official-name">{displayName(activeCharacter)}</span>
    </div>
  );
}
