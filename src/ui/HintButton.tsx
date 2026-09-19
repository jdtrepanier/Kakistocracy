import { useState } from 'react';
import { ACTIONS } from '@/data/actions';
import { getBalance } from '@/data/balance';
import { roomLabelKey } from '@/data/rooms';
import { suggestAction } from '@/engine/hint';
import type { StatKey } from '@/engine/types';
import type { MessageKey } from '@/i18n/en';
import { useGameStore } from '@/store/gameStore';
import { useT } from './useT';

/** i18n key explaining *why* the Hint picked the stat it did, per `engine/hint.ts`'s
 * `Hint.stat` — only the 5 stats `suggestAction` can ever return a key for
 * (`interestRate`/`headlines` never appear, they have no ending threshold to be
 * dangerous about), so this is intentionally partial rather than exhaustive over every
 * `StatKey`. */
const REASON_KEY: Partial<Record<StatKey, MessageKey>> = {
  debt: 'hint.reason.debt',
  feltInflation: 'hint.reason.feltInflation',
  iq: 'hint.reason.iq',
  happiness: 'hint.reason.happiness',
  defcon: 'hint.reason.defcon',
};

/**
 * A "what should I do next" hint, next to the mute toggle (real user feedback: "There
 * should be a hint button next to the mute button... if happiness is too low, you can
 * send a stimulus check"). Same click-to-reveal interaction as the World Map's landmark
 * markers (`SelectLandmarkScreen.tsx`/`MapScreen.tsx`): a click opens a small callout
 * with the suggestion, a second click closes it again. The actual "what's dangerous and
 * what would help" logic all lives in `engine/hint.ts`'s pure `suggestAction` — this
 * component is just wiring, the reason-key lookup above, and the three flavors of copy
 * (a real suggestion, "you're fine," or "not mid-run right now").
 */
export function HintButton() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const game = useGameStore((s) => s.game);
  const difficulty = useGameStore((s) => s.difficulty);
  const screen = useGameStore((s) => s.screen);

  // A hint about nation stats only makes sense mid-run — not on the title screen, and
  // not once the run's already over (win or loss), where every stat is frozen anyway.
  const canSuggest = screen === 'game' && !game.ending;
  const hint = canSuggest ? suggestAction(game, ACTIONS, getBalance(difficulty)) : null;
  const reasonKey = hint ? REASON_KEY[hint.stat] : undefined;

  const suggestionText = !canSuggest
    ? t('hint.notNow')
    : hint
      ? t('hint.suggestion', {
          action: t(hint.action.nameKey),
          room: t(roomLabelKey(hint.action.room)),
        })
      : t('hint.allGood');

  return (
    <button
      type="button"
      className="pixel-button hint-toggle"
      onClick={() => setOpen((v) => !v)}
      aria-label={t('hint.label')}
      aria-expanded={open}
    >
      {t('hint.icon')}
      {open && (
        <span className="hint-callout">
          {reasonKey ? `${t(reasonKey)} ` : ''}
          {suggestionText}
        </span>
      )}
    </button>
  );
}
