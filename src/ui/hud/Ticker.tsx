import { useGameStore } from '@/store/gameStore';
import { useT } from '../useT';

/** Scrolling news ticker at the bottom of the screen. Shows the most recent random
 * monthly event (GAME_PLAN §13) once one has fired; the Phase 0 placeholder welcome
 * message otherwise (before the first month has ended this run). */
export function Ticker() {
  const t = useT();
  const lastEventNameKey = useGameStore((s) => s.lastEventNameKey);
  const text = lastEventNameKey
    ? t('ticker.event', { event: t(lastEventNameKey) })
    : t('ticker.welcome');

  return (
    <footer className="ticker" aria-label={t('ticker.label')}>
      <div className="ticker-track">
        <span className="ticker-item">{text}</span>
        <span className="ticker-item" aria-hidden="true">
          {text}
        </span>
      </div>
    </footer>
  );
}
