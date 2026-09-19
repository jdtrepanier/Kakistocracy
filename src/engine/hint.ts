import type { Balance } from '@/data/balance';
import { checkAvailability, type ActionDef } from './actions';
import { summarizeEffects, type EffectSummary } from './preview';
import type { GameState, StatKey } from './types';

/**
 * The stats that can actually end the run (GAME_PLAN §5), each paired with the
 * `Balance.thresholds` key that ends it and which direction is dangerous. `interestRate`
 * and `headlines` have no ending threshold of their own (interestRate only feeds the
 * inflation formula; headlines is a score, not a survival stat) — excluded entirely,
 * since a Hint can only ever be about a stat that can actually lose the run.
 */
const DANGER_STATS: readonly {
  readonly stat: StatKey;
  readonly thresholdKey: keyof Balance['thresholds'];
  /** `'high'`: this stat ends the run once it climbs *up to* the threshold (debt,
   * feltInflation). `'low'`: it ends the run once it falls *down to* the threshold
   * (iq, happiness, defcon). */
  readonly direction: 'high' | 'low';
}[] = [
  { stat: 'debt', thresholdKey: 'bankruptcyDebt', direction: 'high' },
  { stat: 'feltInflation', thresholdKey: 'hyperinflationFelt', direction: 'high' },
  { stat: 'iq', thresholdKey: 'brainFreezeIq', direction: 'low' },
  { stat: 'happiness', thresholdKey: 'revoltHappiness', direction: 'low' },
  { stat: 'defcon', thresholdKey: 'meltdownDefcon', direction: 'low' },
];

type DangerStat = (typeof DANGER_STATS)[number];

/**
 * How close `stat` is to the ending threshold it can trigger: 0 at the run's own
 * starting value, 1 right at the threshold, higher once past it. Normalized against
 * `balance.start` rather than the stat's raw min/max — two of these thresholds
 * (`brainFreezeIq`/`revoltHappiness`) sit at the stat's own floor of 0 by design ("dumber
 * is stronger, until it isn't" — GAME_PLAN §1), so a plain `threshold / value` ratio
 * would never read as dangerous until the stat had already hit rock bottom. Anchoring on
 * the actual starting value instead gives every stat the same 0-at-the-start, 1-at-the-
 * threshold scale regardless of where its particular threshold happens to sit.
 */
function danger(state: GameState, balance: Balance, entry: DangerStat): number {
  const value = state.stats[entry.stat];
  const start = balance.start[entry.stat];
  const threshold = balance.thresholds[entry.thresholdKey];
  const span = entry.direction === 'high' ? threshold - start : start - threshold;
  if (span <= 0) return 0; // a degenerate difficulty tuning, not expected in practice
  const traveled = entry.direction === 'high' ? value - start : start - value;
  return Math.max(0, traveled / span);
}

function statTotal(summary: EffectSummary, stat: StatKey): number {
  return (summary.immediate[stat] ?? 0) + (summary.overTime[stat] ?? 0);
}

/** Expected change to `stat` from taking `action`, weighted by its own `baseSuccess` —
 * some actions (`stimulus_5000`) only help on success and barely hurt on failure, others
 * (`fire_fed_chair`-style gambles) are net-negative more often than not; averaging by the
 * actual odds is closer to "worth suggesting" than only ever looking at the best case. */
function expectedDelta(action: ActionDef, stat: StatKey): number {
  const p = action.baseSuccess / 100;
  const success = statTotal(summarizeEffects(action.onSuccess), stat);
  const fail = statTotal(summarizeEffects(action.onFail), stat);
  return p * success + (1 - p) * fail;
}

/** How much taking `action` helps the specific stat `entry` is about — positive means
 * it pushes the stat back toward safety, negative means it makes that stat worse (which
 * doesn't disqualify an action outright, since it might still help a *different*
 * dangerous stat, but never gets suggested for this one). */
function goodness(action: ActionDef, entry: DangerStat): number {
  const delta = expectedDelta(action, entry.stat);
  return entry.direction === 'high' ? -delta : delta;
}

export interface Hint {
  /** The stat this suggestion is about — for the UI to explain *why* ("Happiness is
   * low"), not just *what* to do. */
  readonly stat: StatKey;
  readonly action: ActionDef;
}

/**
 * A pure, best-effort "what should I do next" suggestion for the Hint button (real user
 * feedback: "There should be a hint button... if happiness is too low, you can send a
 * stimulus check" — that example is the exact shape this implements, just generalized to
 * every ending-threshold stat instead of hardcoding happiness/stimulus specifically, so
 * it keeps working as the action catalog changes).
 *
 * Ranks every danger stat by how close it is to ending the run, then — starting from the
 * most urgent — looks for the best *currently available* action (`checkAvailability`,
 * ignoring the officer-specific `wrongOfficial` gate since a hint doesn't know which
 * official the player has selected) whose expected effect actually helps that stat.
 * Falls through to the next-most-urgent stat if nothing available helps the top one
 * (e.g. it's IQ-gated, or every action touching it costs more EA than the player has
 * left) rather than giving up entirely. Returns `null` when no stat has crossed
 * `balance.hint.minDanger` yet (everything's still close enough to how the run started
 * that there's nothing urgent to point at) or when literally no available action helps
 * any at-risk stat — the UI falls back to an encouraging "you're doing fine" message
 * either way.
 */
export function suggestAction(
  state: GameState,
  actions: readonly ActionDef[],
  balance: Balance,
): Hint | null {
  const ranked = DANGER_STATS.map((entry) => ({ entry, danger: danger(state, balance, entry) }))
    .filter((d) => d.danger >= balance.hint.minDanger)
    .sort((a, b) => b.danger - a.danger);

  for (const { entry } of ranked) {
    const best = actions
      .filter((action) => checkAvailability(action, state).ok)
      .map((action) => ({ action, goodness: goodness(action, entry) }))
      .filter((c) => c.goodness > 0)
      .sort((a, b) => b.goodness - a.goodness)[0];
    if (best) return { stat: entry.stat, action: best.action };
  }
  return null;
}
