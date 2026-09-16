import { BALANCE, type Balance } from '@/data/balance';
import { eligibleEvents, type EventDef } from '@/data/events';
import { applyEffects, checkElonRage, type EffectContext } from './effects';
import { checkEnding } from './endings';
import { createRng } from './rng';
import type { GameState } from './types';

/** What happened this month, for the UI to show (month report, ticker). `null` when no
 * event could fire — currently only when the run just ended (see `rollMonthlyEvent`). */
export interface EventOutcome {
  readonly event: EventDef;
}

/** Picks one eligible event, weighted by `EventDef.weight`, using `roll` (already scaled
 * to `[0, totalWeight)`) to walk the list — a plain weighted pick, not worth adding a new
 * primitive to `engine/rng.ts`'s small, shared `Rng` interface for. */
function pickWeighted(events: readonly EventDef[], roll: number): EventDef {
  let cursor = 0;
  for (const event of events) {
    cursor += event.weight;
    if (roll < cursor) return event;
  }
  // Floating-point edge case only (roll landed exactly on the total): fall back to the
  // last event rather than throwing.
  return events[events.length - 1] as EventDef;
}

/**
 * Rolls and applies one random monthly event (GAME_PLAN §13). Deliberately a separate
 * step from `engine/economy.ts`'s `tickMonth`, not folded into it: `tickMonth`'s formulas
 * are pure and already pinned by `economy.test.ts`'s exact expected numbers assuming no
 * event fires, so adding event selection as its own function means those fixtures never
 * had to change — `store/gameStore.ts`'s `endMonth` just calls this right after
 * `tickMonth`, threading the already-advanced `rngState` through so it never repeats
 * rolls `tickMonth` itself made.
 *
 * A no-op (returns `state` unchanged, `outcome: null`) once the run has ended — rolling a
 * random news event for a month that just ended in Bankruptcy or victory doesn't mean
 * anything.
 */
export function rollMonthlyEvent(
  state: GameState,
  balance: Balance = BALANCE,
): { readonly state: GameState; readonly outcome: EventOutcome | null } {
  if (state.ending) return { state, outcome: null };

  const eligible = eligibleEvents(state.flags);
  if (eligible.length === 0) return { state, outcome: null };

  const rng = createRng(state.rngState);
  const totalWeight = eligible.reduce((sum, e) => sum + e.weight, 0);
  const picked = pickWeighted(eligible, rng.next() * totalWeight);

  const ctx: EffectContext = {
    stats: state.stats,
    pending: state.pending,
    flags: state.flags,
    atWarWith: state.atWarWith,
    countriesOwned: state.countriesOwned,
    elonRage: state.elonRage,
  };
  const result = checkElonRage(applyEffects(ctx, picked.effects, rng, balance));

  // An event's effects can push a stat past its threshold on their own (DEFCON to 1 from
  // a bad month, say) — `checkEnding` must run here too, not just inside `tickMonth`
  // (see its own doc comment).
  const nextState: GameState = {
    ...state,
    stats: result.stats,
    pending: result.pending,
    flags: result.flags,
    atWarWith: result.atWarWith,
    countriesOwned: result.countriesOwned,
    elonRage: result.elonRage,
    rngState: rng.state,
  };

  return {
    state: { ...nextState, ending: checkEnding(nextState, balance) },
    outcome: { event: picked },
  };
}
