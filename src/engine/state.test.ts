import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/data/balance';
import { createInitialState } from './state';

describe('createInitialState', () => {
  const state = createInitialState(1234);

  it('starts in January 2024 with 3 Executive Actions', () => {
    expect(state.date).toEqual({ year: 2024, month: 1 });
    expect(state.actionsLeft).toBe(3);
    expect(state.actionsUsedThisMonth).toEqual([]);
    expect(state.ending).toBeNull();
  });

  it('uses the starting stats from the game spec', () => {
    expect(state.stats).toEqual({
      debt: 40,
      interestRate: 3.5,
      inflation: 3,
      feltInflation: 6,
      iq: 80,
      happiness: 70,
      defcon: 5,
      headlines: 0,
    });
    expect(state.feltInflationRevealed).toBe(false);
  });

  it('starts with empty history and no pending effects or flags', () => {
    expect(state.pending).toEqual([]);
    expect(state.flags).toEqual([]);
    expect(state.history).toEqual([]);
  });

  it('starts with no wars and no countries owned', () => {
    expect(state.atWarWith).toEqual([]);
    expect(state.countriesOwned).toEqual([]);
  });

  it('starts DEFCON tracking at the starting value with no streak', () => {
    expect(state.defconMonthStart).toBe(5);
    expect(state.defconCalmStreak).toBe(0);
  });

  it('starts Congress intact and midterms unchecked', () => {
    expect(state.midtermsChecked).toBe(false);
    expect(state.congressLost).toBe(false);
    expect(state.lowHappinessStreak).toBe(0);
  });

  it('copies balance values instead of sharing references', () => {
    expect(state.stats).not.toBe(BALANCE.start);
    expect(state.date).not.toBe(BALANCE.calendar.start);
  });

  it('records the seed for replays', () => {
    expect(state.seed).toBe(1234);
    expect(createInitialState(1234)).toEqual(state);
  });
});
