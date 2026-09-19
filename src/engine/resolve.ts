import { BALANCE, type Balance } from '@/data/balance';
import type { ActionDef } from './actions';
import { checkAvailability } from './actions';
import { monthsBetween } from './calendar';
import {
  applyEffects,
  applyOilPriceShock,
  checkElonRage,
  clampStat,
  resolveLandmarkEffects,
  resolveWarEffects,
} from './effects';
import { checkEnding } from './endings';
import { createRng, type Rng } from './rng';
import type { ActionLogEntry, CountryId, Effect, GameDate, GameState, LandmarkId } from './types';

export interface ActionResult {
  readonly actionId: string;
  readonly success: boolean;
  /** Headlines actually earned this time, after the fail ratio and diminishing returns. */
  readonly headlines: number;
}

/**
 * 0–100 success chance for `action` right now: its base chance (no specialty/room/IQ
 * modifiers yet) plus `modifier` — the total of a showdown's chosen responses, if it
 * had one (GAME_PLAN §7) — clamped to the 5–95% band every action in the game respects.
 */
export function computeSuccessChance(action: ActionDef, modifier = 0): number {
  return Math.min(95, Math.max(5, action.baseSuccess + modifier));
}

/** How much of `action`'s base Headlines apply, given how recently it was last done. */
export function diminishingMultiplier(
  actionId: string,
  history: readonly ActionLogEntry[],
  currentDate: GameDate,
  balance: Balance,
): number {
  const recentReps = history.filter(
    (entry) =>
      entry.actionId === actionId &&
      monthsBetween(entry.date, currentDate) < balance.headlineDiminishingWindowMonths,
  ).length;
  const table = balance.headlineDiminishing;
  const index = Math.min(recentReps, table.length - 1);
  return table[index] ?? 1;
}

/** Shared tail of resolving an action, once we already know whether it succeeded and
 * which effect list applies: apply effects, score Headlines, spend EA, log history,
 * and check for an ending. Used by both `resolveAction` (rolls the dice itself) and
 * `resolveBattleAction` (the outcome already came from a tactical battle). */
function finalizeAction(
  state: GameState,
  action: ActionDef,
  success: boolean,
  effects: readonly Effect[],
  rng: Rng,
  balance: Balance,
): { state: GameState; result: ActionResult } {
  const applied = checkElonRage(
    applyEffects(
      {
        stats: state.stats,
        pending: state.pending,
        flags: state.flags,
        atWarWith: state.atWarWith,
        countriesOwned: state.countriesOwned,
        renamedLandmarks: state.renamedLandmarks,
        elonRage: state.elonRage,
      },
      effects,
      rng,
      balance,
    ),
  );

  const multiplier = diminishingMultiplier(action.id, state.history, state.date, balance);
  const baseHeadlines = success ? action.headlines : action.headlines * balance.failHeadlinesRatio;
  const headlinesEarned = Math.round(baseHeadlines * multiplier);

  const stats = {
    ...applied.stats,
    headlines: clampStat('headlines', applied.stats.headlines + headlinesEarned, balance),
  };

  const nextState: GameState = {
    ...state,
    stats,
    pending: applied.pending,
    flags: applied.flags,
    atWarWith: applied.atWarWith,
    countriesOwned: applied.countriesOwned,
    renamedLandmarks: applied.renamedLandmarks,
    elonRage: applied.elonRage,
    rngState: rng.state,
    actionsLeft: state.actionsLeft - action.cost.ea,
    actionsUsedThisMonth: [...state.actionsUsedThisMonth, action.id],
    history: [...state.history, { actionId: action.id, date: state.date, success }],
  };

  return {
    state: { ...nextState, ending: checkEnding(nextState, balance) },
    result: { actionId: action.id, success, headlines: headlinesEarned },
  };
}

/**
 * Resolves one action: rolls its success chance, applies the matching effect list,
 * scores Headlines, and checks for an ending. Throws if the action isn't currently
 * available — callers should check `checkAvailability` first (the UI disables the
 * button; this is a last-line sanity check against calling it anyway).
 *
 * `successModifier` is the total from a showdown's chosen responses (GAME_PLAN §7),
 * or 0 for an action with no showdown. Not used by `declare_war`, which is battle-gated
 * (see `resolveBattleAction`) whenever there's a country left to fight.
 *
 * `landmarkId` is the landmark the player picked on the World Map before confirming
 * (`ui/screens/SelectLandmarkScreen.tsx`, GAME_PLAN "World Map menu") — when set,
 * substitutes it into any generic `{ kind: 'renameLandmark' }` effect in *both*
 * `onSuccess` and `onFail` via `resolveLandmarkEffects` before picking which branch
 * actually applies, the same way `resolveBattleAction` substitutes a country into
 * `declareWar`. Unlike the battle-gated war flow, renaming still rolls its own success
 * chance right here rather than being decided elsewhere first — picking the target
 * doesn't skip the roll, it just decides which landmark a *successful* roll renames.
 * Omitted (or for any action with no `renameLandmark` effect) this is a no-op, same as
 * `resolveWarEffects` is for an action with no `declareWar`.
 */
export function resolveAction(
  state: GameState,
  action: ActionDef,
  balance: Balance = BALANCE,
  successModifier = 0,
  landmarkId?: LandmarkId,
): { state: GameState; result: ActionResult } {
  const availability = checkAvailability(action, state);
  if (!availability.ok) {
    throw new Error(`Action "${action.id}" is not available right now (${availability.reason}).`);
  }

  const rng = createRng(state.rngState);
  const success = rng.chance(computeSuccessChance(action, successModifier) / 100);
  const onSuccess = landmarkId
    ? resolveLandmarkEffects(action.onSuccess, landmarkId)
    : action.onSuccess;
  const onFail = landmarkId ? resolveLandmarkEffects(action.onFail, landmarkId) : action.onFail;
  const effects = success ? onSuccess : onFail;
  return finalizeAction(state, action, success, effects, rng, balance);
}

/**
 * Resolves an action whose outcome was already decided by a tactical battle
 * (GAME_PLAN §7.1, `engine/battle.ts`), rather than by rolling here: `success` is the
 * battle's result, and `country` (the target picked before the battle started) is
 * substituted into the action's generic `{ kind: 'declareWar' }` effect so the country
 * that gets fought is the one that actually ends up at war (`resolveWarEffects`).
 *
 * `battleRngState` is the battle's own final RNG state (it does its own rolling for
 * damage and AI turns) — continuing from there, not from `state.rngState`, so the
 * battle's randomness isn't silently replayed.
 *
 * Also applies `applyOilPriceShock` for the fought `country` (a no-op unless it's Iran)
 * — done here, after `finalizeAction`, rather than through the `Effect` DSL, since the
 * shock depends on both `country` and `success` together and every other war target's
 * `declare_war` effects are shared, generic, and unaware of which country ended up being
 * fought (see that function's doc comment).
 */
export function resolveBattleAction(
  state: GameState,
  action: ActionDef,
  success: boolean,
  country: CountryId,
  battleRngState: number,
  balance: Balance = BALANCE,
): { state: GameState; result: ActionResult } {
  const availability = checkAvailability(action, state);
  if (!availability.ok) {
    throw new Error(`Action "${action.id}" is not available right now (${availability.reason}).`);
  }

  const rng = createRng(battleRngState);
  const effects = success ? resolveWarEffects(action.onSuccess, country) : action.onFail;
  const finalized = finalizeAction(state, action, success, effects, rng, balance);
  const oilPriceIndex = applyOilPriceShock(
    finalized.state.oilPriceIndex,
    country,
    success,
    balance,
  );
  return { ...finalized, state: { ...finalized.state, oilPriceIndex } };
}
