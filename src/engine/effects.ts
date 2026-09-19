import type { Balance } from '@/data/balance';
import { pickRandomCountry, type CountryDef } from '@/data/countries';
import { pickRandomLandmark } from '@/data/landmarks';
import type { Rng } from './rng';
import type { CountryId, Effect, LandmarkId, NationStats, PendingEffect, StatKey } from './types';

/** The mutable-looking (but always-copied) part of state that effects can change. */
export interface EffectContext {
  readonly stats: NationStats;
  readonly pending: readonly PendingEffect[];
  readonly flags: readonly string[];
  readonly atWarWith: readonly CountryId[];
  readonly countriesOwned: readonly CountryId[];
  readonly renamedLandmarks: readonly LandmarkId[];
  readonly elonRage: number;
}

/** Elon's Rage Quit meter threshold (GAME_PLAN §8) — separate from `data/balance.ts`
 * since it's a fixed game-design constant (the meter is always 0–100), not a tunable
 * difficulty number. */
const ELON_RAGE_MAX = 100;

/** Marks the cabinet flag that a `rage` effect just pushed `elonRage` to (or past) the
 * threshold — called once at the tail of any function that can change `elonRage`
 * (`resolve.ts`'s `finalizeAction`, `events.ts`'s `rollMonthlyEvent`), the same way both
 * already call `checkEnding` at their own tail. Idempotent: does nothing once the flag is
 * already set, so it doesn't matter how many times over 100 the meter climbs while he's
 * already gone. Reconciling (see `data/actions.ts`'s `elon_reconciliation`) clears the
 * flag *and* resets the meter via `unflag` + a negative `rage` effect, so this same check
 * naturally doesn't re-fire until he racks up another 100. */
export function checkElonRage(ctx: EffectContext): EffectContext {
  if (ctx.elonRage < ELON_RAGE_MAX || ctx.flags.includes('elonLeftCabinet')) return ctx;
  return { ...ctx, flags: [...ctx.flags, 'elonLeftCabinet'] };
}

/** Adds a random eligible country to `taken` (GAME_PLAN "World Map menu": the joke is
 * running out of countries to hit), or leaves it unchanged if none are left. */
function addRandomCountry(
  taken: readonly CountryId[],
  eligible: (country: CountryDef) => boolean,
  rng: Rng,
): readonly CountryId[] {
  const picked = pickRandomCountry(taken, eligible, rng);
  return picked === null ? taken : addCountry(taken, picked);
}

/** Adds a specific, already-decided country to `taken` if it isn't already there. */
function addCountry(taken: readonly CountryId[], country: CountryId): readonly CountryId[] {
  return taken.includes(country) ? taken : [...taken, country];
}

/** Adds a random not-yet-renamed landmark to `taken` (see `data/landmarks.ts`'s doc
 * comment), or leaves it unchanged once every landmark has been renamed. */
function addRandomLandmark(taken: readonly LandmarkId[], rng: Rng): readonly LandmarkId[] {
  const picked = pickRandomLandmark(taken, rng);
  return picked === null ? taken : addLandmark(taken, picked);
}

/** Adds a specific, already-decided landmark to `taken` if it isn't already there. */
function addLandmark(taken: readonly LandmarkId[], landmark: LandmarkId): readonly LandmarkId[] {
  return taken.includes(landmark) ? taken : [...taken, landmark];
}

/** Clamps a stat to the range declared in `balance.statBounds` (GAME_PLAN §4). */
export function clampStat(stat: StatKey, value: number, balance: Balance): number {
  const { min, max } = balance.statBounds[stat];
  return Math.min(max, Math.max(min, value));
}

function applyDelta(
  stats: NationStats,
  stat: StatKey,
  amount: number,
  balance: Balance,
): NationStats {
  return { ...stats, [stat]: clampStat(stat, stats[stat] + amount, balance) };
}

/**
 * Applies one effect to a stats/pending/flags context, recursing into `chance`'s branch.
 * `spread` and `delayed` don't touch stats immediately — they schedule pending effects that
 * `tickPending` resolves at future month-ends.
 */
export function applyEffect(
  ctx: EffectContext,
  effect: Effect,
  rng: Rng,
  balance: Balance,
): EffectContext {
  switch (effect.kind) {
    case 'delta': {
      // Golden Dome (GAME_PLAN §9 row 22) "absorbs the next DEFCON drop": any negative
      // `defcon` delta, from any source (an action, a random event, a battle loss), is
      // consumed by the shield instead of applied, and the shield is spent. A positive
      // `defcon` delta (DEFCON recovering) isn't a "drop" and passes through untouched.
      if (effect.stat === 'defcon' && effect.amount < 0 && ctx.flags.includes('goldenDomeActive')) {
        return { ...ctx, flags: ctx.flags.filter((f) => f !== 'goldenDomeActive') };
      }
      return { ...ctx, stats: applyDelta(ctx.stats, effect.stat, effect.amount, balance) };
    }

    case 'spread': {
      if (effect.months <= 0) return ctx;
      const perMonth = effect.amount / effect.months;
      const scheduled: PendingEffect[] = Array.from({ length: effect.months }, (_, i) => ({
        stat: effect.stat,
        amount: perMonth,
        inMonths: i + 1,
      }));
      return { ...ctx, pending: [...ctx.pending, ...scheduled] };
    }

    case 'delayed':
      return {
        ...ctx,
        pending: [
          ...ctx.pending,
          { stat: effect.stat, amount: effect.amount, inMonths: effect.inMonths },
        ],
      };

    case 'chance': {
      const branch = rng.chance(effect.p) ? effect.then : (effect.else ?? []);
      return applyEffects(ctx, branch, rng, balance);
    }

    case 'flag':
      return ctx.flags.includes(effect.set) ? ctx : { ...ctx, flags: [...ctx.flags, effect.set] };

    case 'unflag':
      return { ...ctx, flags: ctx.flags.filter((f) => f !== effect.clear) };

    case 'rage':
      return { ...ctx, elonRage: Math.min(100, Math.max(0, ctx.elonRage + effect.amount)) };

    case 'declareWar':
      return { ...ctx, atWarWith: addRandomCountry(ctx.atWarWith, (c) => c.warTarget, rng) };

    case 'declareWarOn':
      return { ...ctx, atWarWith: addCountry(ctx.atWarWith, effect.country) };

    case 'purchaseCountry':
      return {
        ...ctx,
        countriesOwned: addRandomCountry(ctx.countriesOwned, (c) => c.purchasable, rng),
      };

    case 'renameLandmark':
      return { ...ctx, renamedLandmarks: addRandomLandmark(ctx.renamedLandmarks, rng) };

    case 'renameLandmarkOn':
      return { ...ctx, renamedLandmarks: addLandmark(ctx.renamedLandmarks, effect.landmark) };
  }
}

/** Applies a list of effects in order, threading the context (and RNG rolls) through each. */
export function applyEffects(
  ctx: EffectContext,
  effects: readonly Effect[],
  rng: Rng,
  balance: Balance,
): EffectContext {
  return effects.reduce((acc, effect) => applyEffect(acc, effect, rng, balance), ctx);
}

/**
 * Replaces every generic `{ kind: 'declareWar' }` in `effects` with a deterministic
 * `{ kind: 'declareWarOn', country }`, recursing into `chance` branches. Used by the
 * tactical-battle flow (`engine/battle.ts` via `engine/resolve.ts`'s
 * `resolveBattleAction`), which already knows the target — picked before the battle,
 * so the country that gets fought is the one that actually ends up at war.
 */
export function resolveWarEffects(
  effects: readonly Effect[],
  country: CountryId,
): readonly Effect[] {
  return effects.map((effect): Effect => {
    if (effect.kind === 'declareWar') return { kind: 'declareWarOn', country };
    if (effect.kind === 'chance') {
      return {
        ...effect,
        then: resolveWarEffects(effect.then, country),
        else: effect.else && resolveWarEffects(effect.else, country),
      };
    }
    return effect;
  });
}

/**
 * Replaces every generic `{ kind: 'renameLandmark' }` in `effects` with a deterministic
 * `{ kind: 'renameLandmarkOn', landmark }`, recursing into `chance` branches — same shape
 * as `resolveWarEffects` above, for the same reason: `rename_landmark` asks the player to
 * pick a landmark on the World Map before rolling (`store/gameStore.ts`'s
 * `selectLandmark`, `ui/screens/SelectLandmarkScreen.tsx`), so the landmark that actually
 * gets renamed is the one the player picked, not a fresh random one at resolve time.
 */
export function resolveLandmarkEffects(
  effects: readonly Effect[],
  landmark: LandmarkId,
): readonly Effect[] {
  return effects.map((effect): Effect => {
    if (effect.kind === 'renameLandmark') return { kind: 'renameLandmarkOn', landmark };
    if (effect.kind === 'chance') {
      return {
        ...effect,
        then: resolveLandmarkEffects(effect.then, landmark),
        else: effect.else && resolveLandmarkEffects(effect.else, landmark),
      };
    }
    return effect;
  });
}

/**
 * Iran-specific war-outcome shock to the hidden oil-price index (`GameState.oilPriceIndex`
 * — see its doc comment; user feedback: "When you attack Iran, if you lose, huge increase
 * in oil price. You win, oil price goes down."). A no-op for every other country — same
 * "a real-world-tension country gets its own carve-out, never a blanket rule" precedent
 * `battleRosters.ts`'s real-person overrides already use, just for a mechanic instead of a
 * sprite. Called directly from `resolve.ts`'s `resolveBattleAction`, outside the generic
 * `Effect` DSL, since `declare_war`'s own `onSuccess`/`onFail` effect lists are shared by
 * every war target and have no way to say "only if the target was Iran." Clamped to
 * `balance.oilPrice.maxIndex` so a losing streak can't compound into an ever-growing
 * inflation drag forever; `engine/economy.ts`'s `tickMonth` decays it back toward 0 and is
 * the only place it actually touches a visible stat (Felt Inflation).
 */
export function applyOilPriceShock(
  oilPriceIndex: number,
  country: CountryId,
  success: boolean,
  balance: Balance,
): number {
  if (country !== 'iran') return oilPriceIndex;
  const delta = success ? balance.oilPrice.winRelief : balance.oilPrice.lossJolt;
  const { maxIndex } = balance.oilPrice;
  return Math.min(maxIndex, Math.max(-maxIndex, oilPriceIndex + delta));
}

/**
 * Advances the pending-effect queue by one month: applies whatever is due now, keeps the rest.
 * Called once per month-end, after that month's actions have already added their own effects.
 */
export function tickPending(
  stats: NationStats,
  pending: readonly PendingEffect[],
  balance: Balance,
): { stats: NationStats; pending: readonly PendingEffect[] } {
  const advanced = pending.map((p) => ({ ...p, inMonths: p.inMonths - 1 }));
  const due = advanced.filter((p) => p.inMonths <= 0);
  const remaining = advanced.filter((p) => p.inMonths > 0);
  const nextStats = due.reduce((s, p) => applyDelta(s, p.stat, p.amount, balance), stats);
  return { stats: nextStats, pending: remaining };
}
