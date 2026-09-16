import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/data/balance';
import { createInitialState } from './state';
import { checkEnding } from './endings';
import type { GameState } from './types';

function withStats(overrides: Partial<GameState['stats']>): GameState {
  const state = createInitialState(1);
  return { ...state, stats: { ...state.stats, ...overrides } };
}

describe('checkEnding', () => {
  it('returns null when nothing has crossed a threshold', () => {
    expect(checkEnding(createInitialState(1), BALANCE)).toBeNull();
  });

  it('triggers Bankruptcy at or above the debt threshold', () => {
    expect(checkEnding(withStats({ debt: 59.9 }), BALANCE)).toBeNull();
    expect(checkEnding(withStats({ debt: 60 }), BALANCE)).toBe('bankruptcy');
    expect(checkEnding(withStats({ debt: 75 }), BALANCE)).toBe('bankruptcy');
  });

  it('triggers Hyperinflation at or above the felt-inflation threshold', () => {
    expect(checkEnding(withStats({ feltInflation: 24.9 }), BALANCE)).toBeNull();
    expect(checkEnding(withStats({ feltInflation: 25 }), BALANCE)).toBe('hyperinflation');
  });

  it('triggers Brain Freeze at or below zero IQ', () => {
    expect(checkEnding(withStats({ iq: 1 }), BALANCE)).toBeNull();
    expect(checkEnding(withStats({ iq: 0 }), BALANCE)).toBe('brainFreeze');
  });

  it('triggers American Revolt at or below zero happiness', () => {
    expect(checkEnding(withStats({ happiness: 0.1 }), BALANCE)).toBeNull();
    expect(checkEnding(withStats({ happiness: 0 }), BALANCE)).toBe('revolt');
  });

  it('triggers Nuclear Meltdown at or below DEFCON 1', () => {
    expect(checkEnding(withStats({ defcon: 2 }), BALANCE)).toBeNull();
    expect(checkEnding(withStats({ defcon: 1 }), BALANCE)).toBe('nuclear');
  });

  it('triggers Impeachment only once Congress is lost AND the happiness streak is long enough', () => {
    const state = createInitialState(1);
    expect(
      checkEnding({ ...state, congressLost: true, lowHappinessStreak: 2 }, BALANCE),
    ).toBeNull();
    expect(
      checkEnding({ ...state, congressLost: false, lowHappinessStreak: 3 }, BALANCE),
    ).toBeNull();
    expect(checkEnding({ ...state, congressLost: true, lowHappinessStreak: 3 }, BALANCE)).toBe(
      'impeachment',
    );
  });

  it('declares survival once the calendar moves past the final term month', () => {
    const state = createInitialState(1);
    expect(checkEnding({ ...state, date: { year: 2027, month: 12 } }, BALANCE)).toBeNull();
    expect(checkEnding({ ...state, date: { year: 2028, month: 1 } }, BALANCE)).toBe('survived');
  });

  it('resolves ties by a fixed precedence (financial collapse first)', () => {
    const state = withStats({ debt: 60, happiness: 0, defcon: 1 });
    expect(checkEnding(state, BALANCE)).toBe('bankruptcy');
  });
});
