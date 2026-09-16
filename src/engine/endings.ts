import type { Balance } from '@/data/balance';
import { termMonth } from './calendar';
import type { EndingId, GameState } from './types';

/**
 * Checks whether the run has just ended. Call this after ANY state-changing operation —
 * an action's effects can push a stat past its threshold immediately (a war dropping
 * DEFCON to 1, say), and so can the monthly economy tick. Don't wait for month-end only.
 *
 * Precedence is arbitrary but fixed, for the rare case several thresholds are crossed in
 * the same step: financial collapse is checked first as the most immediate, hard stop.
 * See GAME_PLAN §5.
 */
export function checkEnding(state: GameState, balance: Balance): EndingId | null {
  const { stats } = state;

  if (stats.debt >= balance.thresholds.bankruptcyDebt) return 'bankruptcy';
  if (stats.feltInflation >= balance.thresholds.hyperinflationFelt) return 'hyperinflation';
  if (stats.iq <= balance.thresholds.brainFreezeIq) return 'brainFreeze';
  if (stats.happiness <= balance.thresholds.revoltHappiness) return 'revolt';
  if (stats.defcon <= balance.thresholds.meltdownDefcon) return 'nuclear';

  if (
    state.congressLost &&
    state.lowHappinessStreak >= balance.thresholds.impeachmentStreakMonths
  ) {
    return 'impeachment';
  }

  // termMonth() is 1-based (the start month is month 1); survival is confirmed once the
  // calendar has moved past the term's last month with nothing else having ended the run.
  if (termMonth(state.date, balance.calendar.start) > balance.calendar.termMonths) {
    return 'survived';
  }

  return null;
}
