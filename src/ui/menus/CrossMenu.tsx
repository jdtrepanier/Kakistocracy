import { useGameStore } from '@/store/gameStore';
import { playSfx } from '../audio/sfx';
import { useT } from '../useT';

/** The four-icon diamond from GAME_PLAN §11: DECREE / TALK / ITEM / SWITCH. */
export function CrossMenu() {
  const t = useT();
  const openOverlay = useGameStore((s) => s.openOverlay);
  const switchCharacter = useGameStore((s) => s.switchCharacter);

  const openWithSfx = (overlay: Parameters<typeof openOverlay>[0]) => {
    playSfx('blip');
    openOverlay(overlay);
  };

  return (
    <nav className="cross-menu" aria-label={t('menu.label')}>
      <button
        type="button"
        className="pixel-button cross-btn cross-btn-decree"
        onClick={() => openWithSfx('decree')}
      >
        {t('menu.decree')}
      </button>
      <button
        type="button"
        className="pixel-button cross-btn cross-btn-talk"
        onClick={() => openWithSfx('talk')}
      >
        {t('menu.talk')}
      </button>
      <button
        type="button"
        className="pixel-button cross-btn cross-btn-item"
        onClick={() => openWithSfx('item')}
      >
        {t('menu.item')}
      </button>
      <button
        type="button"
        className="pixel-button cross-btn cross-btn-switch"
        onClick={() => {
          playSfx('blip');
          switchCharacter();
        }}
      >
        {t('menu.switch')}
      </button>
    </nav>
  );
}
