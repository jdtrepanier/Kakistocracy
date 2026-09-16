import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/data/balance';
import type { MessageKey } from '@/i18n/en';
import type { ActionDef } from './actions';
import { createRng } from './rng';
import {
  computeSuccessChance,
  diminishingMultiplier,
  resolveAction,
  resolveBattleAction,
} from './resolve';
import { createInitialState } from './state';
import type { ActionLogEntry, GameDate } from './types';

function fakeAction(overrides: Partial<ActionDef> = {}): ActionDef {
  return {
    id: 'fake_action',
    // Not a real content key: this is a throwaway fixture, not shown in any UI.
    nameKey: 'action.fake.name' as MessageKey,
    actors: 'any',
    room: 'ovalOffice',
    cost: { ea: 1 },
    baseSuccess: 80,
    onSuccess: [],
    onFail: [],
    headlines: 0,
    ...overrides,
  };
}

describe('computeSuccessChance', () => {
  it('passes typical values through unchanged with no modifier', () => {
    expect(computeSuccessChance(fakeAction({ baseSuccess: 80 }))).toBe(80);
  });

  it('clamps to the 5–95% band every action respects', () => {
    expect(computeSuccessChance(fakeAction({ baseSuccess: 100 }))).toBe(95);
    expect(computeSuccessChance(fakeAction({ baseSuccess: 0 }))).toBe(5);
  });

  it('adds a showdown modifier before clamping', () => {
    expect(computeSuccessChance(fakeAction({ baseSuccess: 50 }), 20)).toBe(70);
    expect(computeSuccessChance(fakeAction({ baseSuccess: 50 }), -20)).toBe(30);
    expect(computeSuccessChance(fakeAction({ baseSuccess: 90 }), 20)).toBe(95);
    expect(computeSuccessChance(fakeAction({ baseSuccess: 10 }), -20)).toBe(5);
  });
});

describe('diminishingMultiplier', () => {
  const NOW: GameDate = { year: 2025, month: 6 };

  it('is 1 the first time an action is done', () => {
    expect(diminishingMultiplier('rename', [], NOW, BALANCE)).toBe(1);
  });

  it('drops on repeats within the recent window (50% → 25% → 10%)', () => {
    const history: ActionLogEntry[] = [
      { actionId: 'rename', date: { year: 2025, month: 5 }, success: true },
      { actionId: 'rename', date: { year: 2025, month: 4 }, success: true },
      { actionId: 'rename', date: { year: 2025, month: 3 }, success: true },
    ];
    expect(diminishingMultiplier('rename', history.slice(0, 1), NOW, BALANCE)).toBe(0.5);
    expect(diminishingMultiplier('rename', history.slice(0, 2), NOW, BALANCE)).toBe(0.25);
    expect(diminishingMultiplier('rename', history, NOW, BALANCE)).toBe(0.1);
  });

  it('ignores repeats outside the recent window', () => {
    const history: ActionLogEntry[] = [
      { actionId: 'rename', date: { year: 2024, month: 1 }, success: true },
    ];
    expect(diminishingMultiplier('rename', history, NOW, BALANCE)).toBe(1);
  });

  it('ignores other actions entirely', () => {
    const history: ActionLogEntry[] = [
      { actionId: 'tariff', date: { year: 2025, month: 5 }, success: true },
    ];
    expect(diminishingMultiplier('rename', history, NOW, BALANCE)).toBe(1);
  });
});

/** Finds a seed whose very first RNG draw satisfies `predicate` (deterministic, no flakiness). */
function findSeed(predicate: (draw: number) => boolean): number {
  for (let seed = 0; seed < 100_000; seed++) {
    if (predicate(createRng(seed).next())) return seed;
  }
  throw new Error('No seed found in range');
}

describe('resolveAction', () => {
  const action: ActionDef = {
    id: 'stimulus_5000',
    nameKey: 'action.stimulus5000.name',
    actors: ['trump', 'bessent'],
    room: 'treasury',
    cost: { ea: 2 },
    baseSuccess: 90,
    onSuccess: [
      { kind: 'delta', stat: 'debt', amount: 1.7 },
      { kind: 'delta', stat: 'happiness', amount: 15 },
    ],
    onFail: [{ kind: 'delta', stat: 'happiness', amount: -3 }],
    headlines: 40,
  };

  // computeSuccessChance clamps to [5, 95], so a draw below .05 always succeeds and a
  // draw at/above .95 always fails, whatever the action's own base chance is.
  const successSeed = findSeed((n) => n < 0.05);
  const failSeed = findSeed((n) => n >= 0.95);

  it('applies onSuccess effects and full Headlines on a successful roll', () => {
    const state = { ...createInitialState(1), rngState: successSeed };
    const { state: next, result } = resolveAction(state, action);

    expect(result.success).toBe(true);
    expect(result.headlines).toBe(40);
    expect(next.stats.debt).toBeCloseTo(41.7);
    expect(next.stats.happiness).toBeCloseTo(85);
    expect(next.stats.headlines).toBe(40);
  });

  it('applies onFail effects and reduced Headlines on a failed roll', () => {
    const state = { ...createInitialState(1), rngState: failSeed };
    const { state: next, result } = resolveAction(state, action);

    expect(result.success).toBe(false);
    expect(result.headlines).toBe(Math.round(40 * BALANCE.failHeadlinesRatio));
    expect(next.stats.happiness).toBeCloseTo(67);
    expect(next.stats.debt).toBeCloseTo(40); // onFail doesn't touch debt
  });

  it('spends Executive Actions and records the action in history', () => {
    const state = { ...createInitialState(1), rngState: successSeed };
    const { state: next } = resolveAction(state, action);

    expect(next.actionsLeft).toBe(BALANCE.actionsPerMonth - action.cost.ea);
    expect(next.actionsUsedThisMonth).toEqual([action.id]);
    expect(next.history).toEqual([{ actionId: action.id, date: state.date, success: true }]);
  });

  it('advances the RNG so the next roll differs', () => {
    const state = { ...createInitialState(1), rngState: successSeed };
    const { state: next } = resolveAction(state, action);
    expect(next.rngState).not.toBe(state.rngState);
  });

  it('checks for an ending immediately, without waiting for month-end', () => {
    const warlike: ActionDef = {
      ...action,
      id: 'declare_war',
      onSuccess: [{ kind: 'delta', stat: 'defcon', amount: -10 }],
    };
    const state = { ...createInitialState(1), rngState: successSeed };
    const { state: next } = resolveAction(state, warlike);
    expect(next.stats.defcon).toBe(1);
    expect(next.ending).toBe('nuclear');
  });

  it('throws if the action is not currently available', () => {
    const ended = { ...createInitialState(1), ending: 'bankruptcy' as const };
    expect(() => resolveAction(ended, action)).toThrow();

    const brokeState = { ...createInitialState(1), actionsLeft: 0 };
    expect(() => resolveAction(brokeState, action)).toThrow();
  });

  it('applies a showdown successModifier to the roll, not just the preview', () => {
    // A draw of exactly .5 fails the base 50% chance but succeeds once a showdown
    // adds +10 (60%), and the reverse for a −10 modifier.
    const fiftyFifty: ActionDef = { ...action, baseSuccess: 50 };
    const borderlineSeed = findSeed((n) => n >= 0.5 && n < 0.55);

    const boosted = resolveAction(
      { ...createInitialState(1), rngState: borderlineSeed },
      fiftyFifty,
      BALANCE,
      10,
    );
    expect(boosted.result.success).toBe(true);

    const hindered = resolveAction(
      { ...createInitialState(1), rngState: borderlineSeed },
      fiftyFifty,
      BALANCE,
      -10,
    );
    expect(hindered.result.success).toBe(false);
  });
});

describe('resolveBattleAction', () => {
  const declareWar: ActionDef = {
    id: 'declare_war',
    nameKey: 'action.declareWar.name',
    actors: ['trump'],
    room: 'situationRoom',
    cost: { ea: 2 },
    baseSuccess: 60,
    onSuccess: [{ kind: 'delta', stat: 'happiness', amount: 10 }, { kind: 'declareWar' }],
    onFail: [{ kind: 'delta', stat: 'happiness', amount: -3 }],
    headlines: 60,
  };

  it('applies onSuccess and declares war on the given country when the battle was won', () => {
    const state = createInitialState(1);
    const { state: next, result } = resolveBattleAction(state, declareWar, true, 'canada', 999);

    expect(result.success).toBe(true);
    expect(result.headlines).toBe(60);
    expect(next.stats.happiness).toBeCloseTo(80);
    expect(next.atWarWith).toEqual(['canada']);
  });

  it('applies onFail and declares no war when the battle was lost', () => {
    const state = createInitialState(1);
    const { state: next, result } = resolveBattleAction(state, declareWar, false, 'canada', 999);

    expect(result.success).toBe(false);
    expect(next.stats.happiness).toBeCloseTo(67);
    expect(next.atWarWith).toEqual([]);
  });

  it('continues the RNG from the battle state, not from the pre-battle state', () => {
    // declareWar's effects here draw no randomness, so with no draws consumed the
    // resulting rngState is exactly the seed passed in — which must be `battleRngState`
    // (999), not the pre-battle `state.rngState` (12345).
    const state = { ...createInitialState(1), rngState: 12345 };
    const { state: next } = resolveBattleAction(state, declareWar, true, 'canada', 999);
    expect(next.rngState).toBe(999);
  });

  it('still spends EA and logs history, same as a rolled action', () => {
    const state = createInitialState(1);
    const { state: next } = resolveBattleAction(state, declareWar, true, 'canada', 999);
    expect(next.actionsLeft).toBe(BALANCE.actionsPerMonth - declareWar.cost.ea);
    expect(next.history).toEqual([{ actionId: declareWar.id, date: state.date, success: true }]);
  });

  it('throws if the action is not currently available', () => {
    const ended = { ...createInitialState(1), ending: 'bankruptcy' as const };
    expect(() => resolveBattleAction(ended, declareWar, true, 'canada', 999)).toThrow();
  });
});
