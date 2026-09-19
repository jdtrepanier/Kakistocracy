import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/data/balance';
import type { MessageKey } from '@/i18n/en';
import type { ActionDef } from './actions';
import { suggestAction } from './hint';
import { createInitialState } from './state';
import type { GameState } from './types';

function action(overrides: Partial<ActionDef> & Pick<ActionDef, 'id'>): ActionDef {
  return {
    nameKey: 'action.test.name' as MessageKey, // throwaway fixture key, never rendered
    actors: 'any',
    room: 'ovalOffice',
    cost: { ea: 1 },
    baseSuccess: 100,
    onSuccess: [],
    onFail: [],
    headlines: 0,
    ...overrides,
  };
}

const HAPPINESS_BOOST = action({
  id: 'happiness_boost',
  onSuccess: [{ kind: 'delta', stat: 'happiness', amount: 15 }],
});

const IQ_BOOST = action({
  id: 'iq_boost',
  onSuccess: [{ kind: 'delta', stat: 'iq', amount: 10 }],
});

const DEBT_CUT = action({
  id: 'debt_cut',
  onSuccess: [{ kind: 'delta', stat: 'debt', amount: -20 }],
});

function withStats(overrides: Partial<GameState['stats']>): GameState {
  const base = createInitialState(1);
  return { ...base, stats: { ...base.stats, ...overrides } };
}

describe('suggestAction', () => {
  it('returns null at the run’s starting values — nothing is at risk yet', () => {
    expect(suggestAction(createInitialState(1), [HAPPINESS_BOOST, IQ_BOOST], BALANCE)).toBeNull();
  });

  it('suggests a happiness-boosting action once happiness is low (the user’s own example)', () => {
    // start 70, threshold (revoltHappiness) 0 → danger = (70-15)/70 ≈ 0.79, well past minDanger.
    const state = withStats({ happiness: 15 });
    const hint = suggestAction(state, [HAPPINESS_BOOST, IQ_BOOST], BALANCE);
    expect(hint).toEqual({ stat: 'happiness', action: HAPPINESS_BOOST });
  });

  it('picks the most urgent (highest-danger) stat when more than one is at risk', () => {
    // happiness danger = (70-10)/70 ≈ 0.857; iq danger = (80-50)/80 = 0.375 (still above
    // the 0.35 minDanger, but less urgent) — happiness should win.
    const state = withStats({ happiness: 10, iq: 50 });
    const hint = suggestAction(state, [HAPPINESS_BOOST, IQ_BOOST], BALANCE);
    expect(hint?.stat).toBe('happiness');
  });

  it('falls through to a less urgent stat when nothing available helps the top one', () => {
    // Happiness is the most dangerous stat, but its only helpful action costs more EA
    // (3) than the player has left (1) — the hint should fall back to the IQ suggestion
    // (cost 1, affordable) instead of returning null.
    const expensiveHappinessBoost = action({
      ...HAPPINESS_BOOST,
      id: 'happiness_boost_expensive',
      cost: { ea: 3 },
    });
    const state: GameState = { ...withStats({ happiness: 10, iq: 50 }), actionsLeft: 1 };
    const hint = suggestAction(state, [expensiveHappinessBoost, IQ_BOOST], BALANCE);
    expect(hint).toEqual({ stat: 'iq', action: IQ_BOOST });
  });

  it('never suggests an action whose expected effect makes the target stat worse', () => {
    const backfires = action({
      id: 'happiness_backfire',
      baseSuccess: 10,
      onSuccess: [{ kind: 'delta', stat: 'happiness', amount: 5 }],
      onFail: [{ kind: 'delta', stat: 'happiness', amount: -30 }],
    });
    // Expected value: 0.1*5 + 0.9*(-30) = -26.5 — net harmful, should never be suggested.
    const state = withStats({ happiness: 10 });
    expect(suggestAction(state, [backfires], BALANCE)).toBeNull();
  });

  it('handles a ‘high is dangerous’ stat (debt) the same way as a ‘low is dangerous’ one', () => {
    // start 40, threshold (bankruptcyDebt) 60 → danger = (58-40)/20 = 0.9.
    const state = withStats({ debt: 58 });
    const hint = suggestAction(state, [DEBT_CUT, IQ_BOOST], BALANCE);
    expect(hint).toEqual({ stat: 'debt', action: DEBT_CUT });
  });

  it('ignores stats with no ending threshold (interestRate, headlines) entirely', () => {
    const rateOnly = action({
      id: 'rate_only',
      onSuccess: [{ kind: 'delta', stat: 'interestRate', amount: -5 }],
    });
    // Every real danger stat is at its safe starting value; only interestRate moved.
    expect(suggestAction(createInitialState(1), [rateOnly], BALANCE)).toBeNull();
  });

  it('ignores which official is active — a hint isn’t gated by who’s currently selected', () => {
    const bessentOnly = action({
      id: 'bessent_only',
      actors: ['bessent'],
      onSuccess: [{ kind: 'delta', stat: 'happiness', amount: 15 }],
    });
    const state = withStats({ happiness: 10 });
    expect(suggestAction(state, [bessentOnly], BALANCE)).toEqual({
      stat: 'happiness',
      action: bessentOnly,
    });
  });

  it('respects real unavailability (a once-per-month action already used this month)', () => {
    const onceUsed = action({
      id: 'happiness_once',
      limit: 'oncePerMonth',
      onSuccess: [{ kind: 'delta', stat: 'happiness', amount: 15 }],
    });
    const state: GameState = {
      ...withStats({ happiness: 10 }),
      actionsUsedThisMonth: [onceUsed.id],
    };
    expect(suggestAction(state, [onceUsed], BALANCE)).toBeNull();
  });
});
