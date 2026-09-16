import { useEffect } from 'react';
import { BALANCE } from '@/data/balance';
import { computeRank } from '@/engine/scoring';
import type { MessageKey } from '@/i18n/en';
import { useGameStore } from '@/store/gameStore';
import { playSfx } from '../audio/sfx';
import { useT } from '../useT';

/** Shown once the run ends, win or lose (GAME_PLAN §5). */
export function EndingScreen() {
  const t = useT();
  const game = useGameStore((s) => s.game);
  const newGame = useGameStore((s) => s.newGame);
  const ending = game.ending;

  useEffect(() => {
    if (ending) playSfx(ending === 'survived' ? 'success' : 'fail');
  }, [ending]);

  if (!ending) return null;

  const titleKey = `ending.${ending}.title` as MessageKey;
  const bodyKey = `ending.${ending}.body` as MessageKey;

  return (
    <main className="ending-screen">
      <h1 className="ending-title">{t(titleKey)}</h1>
      <p className="ending-body">{t(bodyKey)}</p>

      {ending === 'survived' && (
        <p className="ending-score">
          {t('screen.finalHeadlines', { n: Math.round(game.stats.headlines) })}
          {' — '}
          {t('screen.rank', {
            rank: t(`rank.${computeRank(game.stats.headlines, BALANCE)}` as MessageKey),
          })}
        </p>
      )}

      <button
        type="button"
        className="pixel-button ending-new-game"
        onClick={() => {
          playSfx('blip');
          newGame();
        }}
      >
        {t('screen.newGame')}
      </button>
    </main>
  );
}
