import type { MessageKey } from '@/i18n/en';
import { useGameStore } from '@/store/gameStore';
import { useT } from '../useT';

/** Placeholder for TALK and ITEM (GAME_PLAN §11): the scenes and inventory arrive in
 * Phase 3/5. Keeps the cross menu's four buttons all functional today. */
export function StubOverlay({ titleKey, bodyKey }: { titleKey: MessageKey; bodyKey: MessageKey }) {
  const t = useT();
  const closeOverlay = useGameStore((s) => s.closeOverlay);

  return (
    <div className="menu-overlay">
      <button type="button" className="pixel-button menu-overlay-close" onClick={closeOverlay}>
        {t('screen.close')}
      </button>
      <h2 className="menu-overlay-title">{t(titleKey)}</h2>
      <p className="menu-overlay-body">{t(bodyKey)}</p>
    </div>
  );
}
