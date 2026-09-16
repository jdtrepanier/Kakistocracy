import { useGameStore } from '@/store/gameStore';
import { useT } from '../useT';

/** Small EN/FR switch in the corner of the stage. */
export function LangToggle() {
  const t = useT();
  const toggleLang = useGameStore((s) => s.toggleLang);

  return (
    <button
      type="button"
      className="pixel-button lang-toggle"
      onClick={toggleLang}
      aria-label={t('lang.switchLabel')}
    >
      {t('lang.switchTo')}
    </button>
  );
}
