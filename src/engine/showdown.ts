import type { MessageKey } from '@/i18n/en';

/**
 * A short dialogue-choice scene before a contested action's roll (GAME_PLAN §7
 * "Showdowns"): three rounds, three responses each, every response nudging the
 * eventual success chance up or down. See `data/showdowns.ts` for the actual content
 * and `resolve.ts`'s `successModifier` for how the total gets applied to the roll.
 */
export interface ShowdownChoice {
  readonly labelKey: MessageKey;
  /** Success-chance modifier this response applies, in percentage points. */
  readonly modifier: number;
}

export interface ShowdownRound {
  readonly promptKey: MessageKey;
  readonly choices: readonly [ShowdownChoice, ShowdownChoice, ShowdownChoice];
}

export interface ShowdownDef {
  readonly id: string;
  /** The action this showdown plays out before (see `data/actions.ts`). */
  readonly actionId: string;
  readonly rounds: readonly [ShowdownRound, ShowdownRound, ShowdownRound];
}

/** Sum of the modifiers for the choices made so far (one index per completed round). */
export function totalShowdownModifier(
  showdown: ShowdownDef,
  choiceIndexes: readonly number[],
): number {
  return choiceIndexes.reduce((sum, choiceIndex, roundIndex) => {
    const round = showdown.rounds[roundIndex];
    const choice = round?.choices[choiceIndex];
    return choice ? sum + choice.modifier : sum;
  }, 0);
}

/** Whether every round of `showdown` has a choice recorded yet. */
export function isShowdownComplete(
  showdown: ShowdownDef,
  choiceIndexes: readonly number[],
): boolean {
  return choiceIndexes.length >= showdown.rounds.length;
}
