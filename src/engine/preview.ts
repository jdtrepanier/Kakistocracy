import type { Effect, StatKey } from './types';

/**
 * A best-case summary of what an action's effect list will do, for the Preview window
 * (GAME_PLAN §7's "predicted stat arrows"). It walks a `chance` effect's `then` branch
 * only — the hopeful outcome — and flags that a gamble exists via `hasChance` rather
 * than trying to average two branches into one misleading number. `declareWar` and
 * `purchaseCountry` don't touch a stat directly (they pick a country at resolve time),
 * so they're surfaced as `hasRandomCountry` instead of a stat delta.
 */
export interface EffectSummary {
  /** Stat changes that land the moment the action resolves. */
  readonly immediate: Readonly<Partial<Record<StatKey, number>>>;
  /** Stat changes spread or delayed into future months. */
  readonly overTime: Readonly<Partial<Record<StatKey, number>>>;
  /** True if a `chance` effect is in the mix (the preview only shows its "then" branch). */
  readonly hasChance: boolean;
  /** True if `declareWar` or `purchaseCountry` is in the mix (target picked on resolve). */
  readonly hasRandomCountry: boolean;
}

function addAmount(
  totals: Readonly<Partial<Record<StatKey, number>>>,
  stat: StatKey,
  amount: number,
): Readonly<Partial<Record<StatKey, number>>> {
  return { ...totals, [stat]: (totals[stat] ?? 0) + amount };
}

function walk(effects: readonly Effect[], acc: EffectSummary): EffectSummary {
  return effects.reduce((next, effect): EffectSummary => {
    switch (effect.kind) {
      case 'delta':
        return { ...next, immediate: addAmount(next.immediate, effect.stat, effect.amount) };
      case 'spread':
      case 'delayed':
        return { ...next, overTime: addAmount(next.overTime, effect.stat, effect.amount) };
      case 'chance':
        return walk(effect.then, { ...next, hasChance: true });
      case 'declareWar':
      case 'purchaseCountry':
        return { ...next, hasRandomCountry: true };
      case 'declareWarOn':
        // Only appears after `resolveWarEffects` has substituted a concrete country in
        // at battle-resolution time — never in the data the Preview window walks.
        return next;
      case 'flag':
      case 'unflag':
      case 'rage':
        return next;
    }
  }, acc);
}

export function summarizeEffects(effects: readonly Effect[]): EffectSummary {
  return walk(effects, { immediate: {}, overTime: {}, hasChance: false, hasRandomCountry: false });
}
