import { BALANCE, type Balance } from '@/data/balance';
import { addMonths, isSameMonth } from './calendar';
import { clampStat, tickPending } from './effects';
import { checkEnding } from './endings';
import type { GameState, NationStats } from './types';

/**
 * Deterministic monthly economy formulas (GAME_PLAN §6): interest cost on the Debt,
 * inflation drifting toward a target set by the interest rate, felt inflation running
 * hotter than official, and Happiness reacting to felt inflation and reverting to its
 * anchor. No randomness here — random monthly events are a later phase.
 *
 * `oilPriceIndex` (`GameState.oilPriceIndex`, only ever nonzero after a Declare-War-on-Iran
 * battle) nudges Felt Inflation directly, on top of its own drift toward official
 * inflation — the one and only channel the hidden index actually reaches a stat the
 * player can see (see that field's doc comment).
 */
function applyEconomyFormulas(
  stats: NationStats,
  oilPriceIndex: number,
  balance: Balance,
): NationStats {
  const e = balance.economy;

  const effectiveYield =
    stats.interestRate +
    e.yieldSpread +
    e.debtPremiumPerTrillion * Math.max(0, stats.debt - e.debtPremiumStart) +
    e.inflationPremiumPerPoint * Math.max(0, stats.feltInflation - e.inflationPremiumStart);
  const interestCost = (stats.debt * effectiveYield) / 100 / 12;
  const debt = stats.debt + e.primaryDeficitPerMonth + interestCost;

  const inflationTarget =
    e.inflationBase + (e.neutralRate - stats.interestRate) * e.rateSensitivity;
  const inflation = stats.inflation + (inflationTarget - stats.inflation) * e.inflationDrift;
  const feltInflation =
    stats.feltInflation +
    (inflation + e.feltGap - stats.feltInflation) * e.feltDrift +
    oilPriceIndex * balance.oilPrice.feltInflationPerPoint;

  const happiness =
    stats.happiness -
    e.happinessPricePain * Math.max(0, feltInflation - e.happinessPainStart) +
    e.happinessReversion * (e.happinessAnchor - stats.happiness);

  return {
    ...stats,
    debt: clampStat('debt', debt, balance),
    inflation: clampStat('inflation', inflation, balance),
    feltInflation: clampStat('feltInflation', feltInflation, balance),
    happiness: clampStat('happiness', happiness, balance),
  };
}

/** Decays the hidden oil-price index toward 0 by one month (`GameState.oilPriceIndex`'s
 * doc comment) — a shock from an Iran battle fades over time rather than persisting
 * forever. Snaps to exactly 0 once it's close enough that further decay is imperceptible,
 * so a run doesn't carry a permanent `0.0000123`-style residue. */
function decayOilPriceIndex(oilPriceIndex: number, balance: Balance): number {
  const decayed = oilPriceIndex * balance.oilPrice.decayFactor;
  return Math.abs(decayed) < 0.5 ? 0 : decayed;
}

/**
 * DEFCON recovers on its own after a few calm months (GAME_PLAN §6): if it didn't drop
 * during the month just finished, the calm streak grows; once it's long enough, DEFCON
 * ticks back up by one and the streak resets.
 */
function updateDefconCalm(
  defcon: number,
  monthStartDefcon: number,
  streak: number,
  balance: Balance,
): { defcon: number; streak: number } {
  const decreased = defcon < monthStartDefcon;
  if (decreased) return { defcon, streak: 0 };

  const nextStreak = streak + 1;
  if (nextStreak >= balance.economy.defconCalmMonths) {
    return { defcon: clampStat('defcon', defcon + 1, balance), streak: 0 };
  }
  return { defcon, streak: nextStreak };
}

/**
 * Midterms (GAME_PLAN §3) run once, at a fixed month: Congress is lost if Happiness is
 * below the threshold right then. Once lost, every month-end below the impeachment
 * happiness threshold extends a streak that `checkEnding` watches (§5).
 */
function updateCongress(
  state: GameState,
  finalStats: NationStats,
  balance: Balance,
): Pick<GameState, 'congressLost' | 'midtermsChecked' | 'lowHappinessStreak'> {
  let { congressLost, midtermsChecked, lowHappinessStreak } = state;

  if (!midtermsChecked && isSameMonth(state.date, balance.calendar.midterms)) {
    congressLost = finalStats.happiness < balance.calendar.midterms.happinessNeeded;
    midtermsChecked = true;
  }

  lowHappinessStreak =
    congressLost && finalStats.happiness <= balance.thresholds.impeachmentHappiness
      ? lowHappinessStreak + 1
      : 0;

  return { congressLost, midtermsChecked, lowHappinessStreak };
}

/**
 * How many Executive Actions the new month opens with, and which of `flags`' one-month
 * modifiers get consumed doing it (GAME_PLAN §9): Government Shutdown's "next month only
 * 1 EA" (`shutdownPending`) and Executive Order Spree's "+2 EA next month"
 * (`executiveOrderBonus`). A shutdown wins if a month somehow ends with both flags set —
 * "only 1 EA" is a hard cap, not something a bonus should be able to talk its way out of.
 */
function resolveActionsLeft(
  flags: readonly string[],
  balance: Balance,
): { actionsLeft: number; flags: readonly string[] } {
  if (flags.includes('shutdownPending')) {
    return {
      actionsLeft: 1,
      flags: flags.filter((f) => f !== 'shutdownPending' && f !== 'executiveOrderBonus'),
    };
  }
  if (flags.includes('executiveOrderBonus')) {
    return {
      actionsLeft: balance.actionsPerMonth + 2,
      flags: flags.filter((f) => f !== 'executiveOrderBonus'),
    };
  }
  return { actionsLeft: balance.actionsPerMonth, flags };
}

/**
 * Ends the current month and opens the next one: resolves due pending effects, runs the
 * economy formulas, updates DEFCON and Congress tracking, advances the calendar, refills
 * Executive Actions (per `resolveActionsLeft` above), and checks for an ending. A no-op
 * once the run has already ended.
 */
export function tickMonth(state: GameState, balance: Balance = BALANCE): GameState {
  if (state.ending) return state;

  const afterPending = tickPending(state.stats, state.pending, balance);
  const statsAfterEconomy = applyEconomyFormulas(afterPending.stats, state.oilPriceIndex, balance);
  const oilPriceIndex = decayOilPriceIndex(state.oilPriceIndex, balance);

  const defconResult = updateDefconCalm(
    statsAfterEconomy.defcon,
    state.defconMonthStart,
    state.defconCalmStreak,
    balance,
  );
  const stats: NationStats = { ...statsAfterEconomy, defcon: defconResult.defcon };

  const congress = updateCongress(state, stats, balance);
  const date = addMonths(state.date, 1);
  // Set once, the month Congress is actually lost — gates `senate_trial` (data/actions.ts)
  // and its Impeachment showdown behind "there's actually a trial to survive."
  const flagsWithCongress =
    congress.congressLost && !state.flags.includes('congressLost')
      ? [...state.flags, 'congressLost']
      : state.flags;
  const ea = resolveActionsLeft(flagsWithCongress, balance);

  const nextState: GameState = {
    ...state,
    stats,
    pending: afterPending.pending,
    flags: ea.flags,
    date,
    actionsLeft: ea.actionsLeft,
    actionsUsedThisMonth: [],
    defconMonthStart: stats.defcon,
    defconCalmStreak: defconResult.streak,
    oilPriceIndex,
    ...congress,
  };

  return { ...nextState, ending: checkEnding(nextState, balance) };
}

/**
 * Grants one bonus Executive Action outside the normal monthly refill. Pure and
 * generic — not tied to any one mechanic — but written for Melania's hide-and-seek
 * (GAME_PLAN §8: find the room she's hiding in this month for +1 EA), whose
 * room-tracking lives in `store/gameStore.ts` (session/UI state, not simulated
 * `GameState`) since it isn't part of the deterministic engine model.
 */
export function grantBonusAction(state: GameState): GameState {
  return { ...state, actionsLeft: state.actionsLeft + 1 };
}
