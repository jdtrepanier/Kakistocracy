import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/data/balance';
import {
  applyEffect,
  applyEffects,
  applyOilPriceShock,
  checkElonRage,
  clampStat,
  resolveWarEffects,
  tickPending,
  type EffectContext,
} from './effects';
import { createRng, type Rng } from './rng';
import type { Effect, NationStats } from './types';

const STATS: NationStats = { ...BALANCE.start };
const CTX = (overrides: Partial<EffectContext> = {}): EffectContext => ({
  stats: STATS,
  pending: [],
  flags: [],
  atWarWith: [],
  countriesOwned: [],
  renamedLandmarks: [],
  elonRage: 0,
  ...overrides,
});

/** A fake RNG whose chance() always returns a fixed value, for deterministic branch tests. */
function fixedRng(chanceResult: boolean): Rng {
  return {
    next: () => (chanceResult ? 0 : 0.999),
    int: () => 0,
    chance: () => chanceResult,
    pick: (items) => items[0] as never,
    state: 0,
  };
}

describe('clampStat', () => {
  it('clamps to the bounds declared in balance.statBounds', () => {
    expect(clampStat('happiness', 150, BALANCE)).toBe(100);
    expect(clampStat('happiness', -10, BALANCE)).toBe(0);
    expect(clampStat('defcon', 0, BALANCE)).toBe(1);
    expect(clampStat('defcon', 9, BALANCE)).toBe(5);
    expect(clampStat('debt', -5, BALANCE)).toBe(0);
    expect(clampStat('iq', 42, BALANCE)).toBe(42);
  });
});

describe('applyEffect: delta', () => {
  it('adds the amount and clamps the result', () => {
    const ctx = applyEffect(
      CTX(),
      { kind: 'delta', stat: 'debt', amount: 2 },
      createRng(1),
      BALANCE,
    );
    expect(ctx.stats.debt).toBe(42);
  });

  it('clamps happiness to [0, 100]', () => {
    const ctx = applyEffect(
      CTX({ stats: { ...STATS, happiness: 95 } }),
      { kind: 'delta', stat: 'happiness', amount: 20 },
      createRng(1),
      BALANCE,
    );
    expect(ctx.stats.happiness).toBe(100);
  });

  it('leaves pending and flags untouched', () => {
    const before = CTX({ pending: [{ stat: 'debt', amount: 1, inMonths: 2 }], flags: ['a'] });
    const after = applyEffect(
      before,
      { kind: 'delta', stat: 'debt', amount: 1 },
      createRng(1),
      BALANCE,
    );
    expect(after.pending).toBe(before.pending);
    expect(after.flags).toBe(before.flags);
  });

  it('Golden Dome absorbs the next DEFCON drop instead of applying it (GAME_PLAN §9)', () => {
    const before = CTX({ stats: { ...STATS, defcon: 5 }, flags: ['goldenDomeActive'] });
    const after = applyEffect(
      before,
      { kind: 'delta', stat: 'defcon', amount: -1 },
      createRng(1),
      BALANCE,
    );
    expect(after.stats.defcon).toBe(5);
    expect(after.flags).toEqual([]);
  });

  it('only absorbs a negative DEFCON delta — DEFCON recovering passes through untouched', () => {
    const before = CTX({ stats: { ...STATS, defcon: 3 }, flags: ['goldenDomeActive'] });
    const after = applyEffect(
      before,
      { kind: 'delta', stat: 'defcon', amount: 1 },
      createRng(1),
      BALANCE,
    );
    expect(after.stats.defcon).toBe(4);
    expect(after.flags).toEqual(['goldenDomeActive']);
  });

  it('leaves a DEFCON drop untouched when the shield is not up', () => {
    const before = CTX({ stats: { ...STATS, defcon: 5 } });
    const after = applyEffect(
      before,
      { kind: 'delta', stat: 'defcon', amount: -1 },
      createRng(1),
      BALANCE,
    );
    expect(after.stats.defcon).toBe(4);
  });
});

describe('applyEffect: spread', () => {
  it('schedules one pending entry per month, summing to the total amount', () => {
    const ctx = applyEffect(
      CTX(),
      { kind: 'spread', stat: 'feltInflation', amount: 3, months: 6 },
      createRng(1),
      BALANCE,
    );
    expect(ctx.pending).toHaveLength(6);
    expect(ctx.pending.map((p) => p.inMonths)).toEqual([1, 2, 3, 4, 5, 6]);
    const total = ctx.pending.reduce((sum, p) => sum + p.amount, 0);
    expect(total).toBeCloseTo(3);
    expect(ctx.stats).toBe(STATS); // no immediate effect
  });

  it('does nothing for zero or negative months', () => {
    const ctx = applyEffect(
      CTX(),
      { kind: 'spread', stat: 'debt', amount: 5, months: 0 },
      createRng(1),
      BALANCE,
    );
    expect(ctx.pending).toEqual([]);
  });
});

describe('applyEffect: delayed', () => {
  it('schedules a single pending entry', () => {
    const ctx = applyEffect(
      CTX(),
      { kind: 'delayed', stat: 'debt', amount: 1.95, inMonths: 4 },
      createRng(1),
      BALANCE,
    );
    expect(ctx.pending).toEqual([{ stat: 'debt', amount: 1.95, inMonths: 4 }]);
  });
});

describe('applyEffect: chance', () => {
  const effect: Effect = {
    kind: 'chance',
    p: 0.5,
    then: [{ kind: 'delta', stat: 'happiness', amount: 5 }],
    else: [{ kind: 'delta', stat: 'happiness', amount: -5 }],
  };

  it('applies the "then" branch when the roll succeeds', () => {
    expect(applyEffect(CTX(), effect, fixedRng(true), BALANCE).stats.happiness).toBe(75);
  });

  it('applies the "else" branch when the roll fails', () => {
    expect(applyEffect(CTX(), effect, fixedRng(false), BALANCE).stats.happiness).toBe(65);
  });

  it('does nothing on failure when no "else" is given', () => {
    const onlyThen: Effect = { kind: 'chance', p: 0.5, then: [{ kind: 'flag', set: 'x' }] };
    const ctx = applyEffect(CTX(), onlyThen, fixedRng(false), BALANCE);
    expect(ctx.flags).toEqual([]);
  });
});

describe('applyEffect: flag', () => {
  it('adds a new flag', () => {
    expect(
      applyEffect(CTX(), { kind: 'flag', set: 'fedChairFired' }, createRng(1), BALANCE).flags,
    ).toEqual(['fedChairFired']);
  });

  it('does not duplicate an existing flag', () => {
    const ctx = applyEffect(
      CTX({ flags: ['fedChairFired'] }),
      { kind: 'flag', set: 'fedChairFired' },
      createRng(1),
      BALANCE,
    );
    expect(ctx.flags).toEqual(['fedChairFired']);
  });
});

describe('applyEffect: rage', () => {
  it("adds to Elon's Rage Quit meter (GAME_PLAN §8)", () => {
    const ctx = applyEffect(CTX(), { kind: 'rage', amount: 20 }, createRng(1), BALANCE);
    expect(ctx.elonRage).toBe(20);
  });

  it('accumulates across multiple effects', () => {
    const ctx = applyEffects(
      CTX(),
      [
        { kind: 'rage', amount: 20 },
        { kind: 'rage', amount: 15 },
      ],
      createRng(1),
      BALANCE,
    );
    expect(ctx.elonRage).toBe(35);
  });

  it('clamps to [0, 100]', () => {
    const high = applyEffect(
      CTX({ elonRage: 90 }),
      { kind: 'rage', amount: 50 },
      createRng(1),
      BALANCE,
    );
    expect(high.elonRage).toBe(100);

    const low = applyEffect(
      CTX({ elonRage: 10 }),
      { kind: 'rage', amount: -50 },
      createRng(1),
      BALANCE,
    );
    expect(low.elonRage).toBe(0);
  });

  it('leaves stats, pending and flags untouched', () => {
    const before = CTX();
    const ctx = applyEffect(before, { kind: 'rage', amount: 20 }, createRng(1), BALANCE);
    expect(ctx.stats).toBe(before.stats);
    expect(ctx.pending).toBe(before.pending);
    expect(ctx.flags).toBe(before.flags);
  });
});

describe('applyEffect: unflag', () => {
  it('removes a set flag', () => {
    const ctx = applyEffect(
      CTX({ flags: ['elonLeftCabinet', 'goldenDomeActive'] }),
      { kind: 'unflag', clear: 'elonLeftCabinet' },
      createRng(1),
      BALANCE,
    );
    expect(ctx.flags).toEqual(['goldenDomeActive']);
  });

  it('is a no-op if the flag was never set', () => {
    const before = CTX({ flags: ['goldenDomeActive'] });
    const ctx = applyEffect(
      before,
      { kind: 'unflag', clear: 'elonLeftCabinet' },
      createRng(1),
      BALANCE,
    );
    expect(ctx.flags).toEqual(['goldenDomeActive']);
  });
});

describe('checkElonRage', () => {
  it('sets elonLeftCabinet once the meter hits 100', () => {
    const ctx = checkElonRage(CTX({ elonRage: 100 }));
    expect(ctx.flags).toEqual(['elonLeftCabinet']);
  });

  it('leaves flags untouched below the threshold', () => {
    const ctx = checkElonRage(CTX({ elonRage: 99 }));
    expect(ctx.flags).toEqual([]);
  });

  it('is idempotent once the flag is already set', () => {
    const before = CTX({ elonRage: 100, flags: ['elonLeftCabinet'] });
    const ctx = checkElonRage(before);
    expect(ctx).toBe(before);
  });
});

describe('applyEffect: declareWar', () => {
  it('adds a random not-yet-warred country', () => {
    // fixedRng.pick returns the first candidate, and COUNTRIES starts with 'canada'.
    const ctx = applyEffect(CTX(), { kind: 'declareWar' }, fixedRng(true), BALANCE);
    expect(ctx.atWarWith).toEqual(['canada']);
  });

  it('skips a country already at war and picks the next eligible one', () => {
    const ctx = applyEffect(
      CTX({ atWarWith: ['canada'] }),
      { kind: 'declareWar' },
      fixedRng(true),
      BALANCE,
    );
    expect(ctx.atWarWith).toEqual(['canada', 'greenland']);
  });

  it('is a no-op once every eligible country is already at war', () => {
    const before = CTX({
      atWarWith: ['canada', 'greenland', 'panama', 'mexico', 'iran', 'venezuela', 'russia'],
    });
    const ctx = applyEffect(before, { kind: 'declareWar' }, fixedRng(true), BALANCE);
    expect(ctx.atWarWith).toBe(before.atWarWith);
  });

  it('leaves stats, pending and flags untouched', () => {
    const before = CTX();
    const ctx = applyEffect(before, { kind: 'declareWar' }, fixedRng(true), BALANCE);
    expect(ctx.stats).toBe(before.stats);
    expect(ctx.pending).toBe(before.pending);
    expect(ctx.flags).toBe(before.flags);
  });
});

describe('applyEffect: declareWarOn', () => {
  it('adds the given country, regardless of RNG', () => {
    const ctx = applyEffect(
      CTX(),
      { kind: 'declareWarOn', country: 'russia' },
      fixedRng(true),
      BALANCE,
    );
    expect(ctx.atWarWith).toEqual(['russia']);
  });

  it('is idempotent if the country is already at war', () => {
    const before = CTX({ atWarWith: ['russia'] });
    const ctx = applyEffect(
      before,
      { kind: 'declareWarOn', country: 'russia' },
      fixedRng(true),
      BALANCE,
    );
    expect(ctx.atWarWith).toBe(before.atWarWith);
  });
});

describe('applyEffect: purchaseCountry', () => {
  it('adds a random not-yet-owned purchasable country', () => {
    const ctx = applyEffect(CTX(), { kind: 'purchaseCountry' }, fixedRng(true), BALANCE);
    expect(ctx.countriesOwned).toEqual(['canada']);
  });

  it('never picks a country that is not purchasable', () => {
    // canada, greenland and panama are purchasable; mexico is not (GAME_PLAN §10).
    const before = CTX({ countriesOwned: ['canada', 'greenland', 'panama'] });
    const ctx = applyEffect(before, { kind: 'purchaseCountry' }, fixedRng(true), BALANCE);
    expect(ctx.countriesOwned).toBe(before.countriesOwned);
  });
});

describe('applyEffects', () => {
  it('threads multiple effects through in order', () => {
    const effects: Effect[] = [
      { kind: 'delta', stat: 'debt', amount: 1 },
      { kind: 'delta', stat: 'happiness', amount: 10 },
      { kind: 'flag', set: 'stimulusPaid' },
    ];
    const ctx = applyEffects(CTX(), effects, createRng(1), BALANCE);
    expect(ctx.stats.debt).toBe(41);
    expect(ctx.stats.happiness).toBe(80);
    expect(ctx.flags).toEqual(['stimulusPaid']);
  });
});

describe('resolveWarEffects', () => {
  it('replaces a top-level declareWar with a deterministic declareWarOn', () => {
    const effects: Effect[] = [{ kind: 'delta', stat: 'iq', amount: -5 }, { kind: 'declareWar' }];
    expect(resolveWarEffects(effects, 'canada')).toEqual([
      { kind: 'delta', stat: 'iq', amount: -5 },
      { kind: 'declareWarOn', country: 'canada' },
    ]);
  });

  it('recurses into chance branches', () => {
    const effects: Effect[] = [
      {
        kind: 'chance',
        p: 0.5,
        then: [{ kind: 'declareWar' }],
        else: [{ kind: 'delta', stat: 'happiness', amount: -1 }],
      },
    ];
    const [resolved] = resolveWarEffects(effects, 'mexico');
    expect(resolved).toEqual({
      kind: 'chance',
      p: 0.5,
      then: [{ kind: 'declareWarOn', country: 'mexico' }],
      else: [{ kind: 'delta', stat: 'happiness', amount: -1 }],
    });
  });

  it('leaves effects with no declareWar untouched', () => {
    const effects: Effect[] = [{ kind: 'delta', stat: 'debt', amount: 1 }];
    expect(resolveWarEffects(effects, 'canada')).toEqual(effects);
  });
});

describe('tickPending', () => {
  it('applies entries due this month and keeps the rest, decremented', () => {
    const pending = [
      { stat: 'debt' as const, amount: 0.5, inMonths: 1 },
      { stat: 'happiness' as const, amount: -2, inMonths: 3 },
    ];
    const result = tickPending(STATS, pending, BALANCE);
    expect(result.stats.debt).toBe(40.5);
    expect(result.stats.happiness).toBe(70); // not due yet
    expect(result.pending).toEqual([{ stat: 'happiness', amount: -2, inMonths: 2 }]);
  });

  it('applies several entries due the same month and clamps the total', () => {
    const pending = [
      { stat: 'happiness' as const, amount: -60, inMonths: 1 },
      { stat: 'happiness' as const, amount: -60, inMonths: 1 },
    ];
    const result = tickPending(STATS, pending, BALANCE);
    expect(result.stats.happiness).toBe(0);
    expect(result.pending).toEqual([]);
  });

  it('does nothing with an empty queue', () => {
    const result = tickPending(STATS, [], BALANCE);
    expect(result.stats).toBe(STATS);
    expect(result.pending).toEqual([]);
  });
});

describe('applyOilPriceShock', () => {
  it('is a no-op for every country except Iran, win or lose', () => {
    expect(applyOilPriceShock(0, 'canada', false, BALANCE)).toBe(0);
    expect(applyOilPriceShock(0, 'russia', true, BALANCE)).toBe(0);
    expect(applyOilPriceShock(50, 'venezuela', false, BALANCE)).toBe(50);
  });

  it('adds the loss jolt on an Iran loss, from any starting index', () => {
    expect(applyOilPriceShock(0, 'iran', false, BALANCE)).toBe(BALANCE.oilPrice.lossJolt);
    expect(applyOilPriceShock(10, 'iran', false, BALANCE)).toBe(10 + BALANCE.oilPrice.lossJolt);
  });

  it('adds the (negative) win relief on an Iran win', () => {
    expect(applyOilPriceShock(0, 'iran', true, BALANCE)).toBe(BALANCE.oilPrice.winRelief);
    expect(applyOilPriceShock(10, 'iran', true, BALANCE)).toBe(10 + BALANCE.oilPrice.winRelief);
  });

  it('clamps to ±maxIndex in either direction', () => {
    const nearMax = BALANCE.oilPrice.maxIndex - 5;
    expect(applyOilPriceShock(nearMax, 'iran', false, BALANCE)).toBe(BALANCE.oilPrice.maxIndex);
    const nearMin = -BALANCE.oilPrice.maxIndex + 5;
    expect(applyOilPriceShock(nearMin, 'iran', true, BALANCE)).toBe(-BALANCE.oilPrice.maxIndex);
  });
});
