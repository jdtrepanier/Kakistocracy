import { facingItem } from '@/data/roomLayouts';
import { useGameStore } from '@/store/gameStore';
import { playSfx } from '../audio/sfx';
import { useT } from '../useT';

/** The four-icon diamond from GAME_PLAN §11: DECREE / TALK / ITEM / SWITCH. */
export function CrossMenu() {
  const t = useT();
  const openOverlay = useGameStore((s) => s.openOverlay);
  const switchCharacter = useGameStore((s) => s.switchCharacter);
  const player = useGameStore((s) => s.player);
  const items = useGameStore((s) => s.game.items);
  const grabItem = useGameStore((s) => s.grabItem);

  const openWithSfx = (overlay: Parameters<typeof openOverlay>[0]) => {
    playSfx('blip');
    openOverlay(overlay);
  };

  // ITEM does double duty: facing an uncollected item's pedestal grabs it on the spot
  // (same "act on what's in front of you" convention DECREE's own object-facing hint
  // uses); otherwise it opens the ordinary inventory list overlay, same as before.
  const handleItemButton = () => {
    const targetId = facingItem(player.roomId, player.pos, player.facing);
    if (targetId && !items.includes(targetId)) {
      playSfx('confirm');
      grabItem(targetId);
      return;
    }
    openWithSfx('item');
  };

  return (
    <nav className="cross-menu" aria-label={t('menu.label')}>
      <button
        type="button"
        className="pixel-button cross-btn cross-btn-decree"
        onClick={() => openWithSfx('decree')}
        title={t('menu.decree')}
        aria-label={t('menu.decree')}
      >
        {/* Icons, not text (GAME_PLAN §11 always called these "four icons in a diamond" —
         * the original text labels were a placeholder, same spirit as the emoji already
         * used for the mute button). Visible glyph is decorative; the real label is
         * `aria-label`/`title` above, from the same i18n keys the text used to render. */}
        <span aria-hidden="true">📜</span>
      </button>
      <button
        type="button"
        className="pixel-button cross-btn cross-btn-talk"
        onClick={() => openWithSfx('talk')}
        title={t('menu.talk')}
        aria-label={t('menu.talk')}
      >
        <span aria-hidden="true">💬</span>
      </button>
      <button
        type="button"
        className="pixel-button cross-btn cross-btn-item"
        onClick={handleItemButton}
        title={t('menu.item')}
        aria-label={t('menu.item')}
      >
        <span aria-hidden="true">🎒</span>
      </button>
      <button
        type="button"
        className="pixel-button cross-btn cross-btn-switch"
        onClick={() => {
          playSfx('blip');
          switchCharacter();
        }}
        title={t('menu.switch')}
        aria-label={t('menu.switch')}
      >
        <span aria-hidden="true">🔄</span>
      </button>
    </nav>
  );
}
