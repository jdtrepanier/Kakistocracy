import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/data/balance';
import { tickMonth } from './economy';
import { createInitialState } from './state';
import type { GameState } from './types';

function tickTimes(state: GameState, n: number): GameState {
  let s = state;
  for (let i = 0; i < n; i++) s = tickMonth(s);
  return s;
}

describe('tickMonth: economy formulas (no actions taken)', () => {
  // Cross-checked against a standalone reference simulation of the §6 formulas.
  const state = createInitialState(1);

  it('month 1', () => {
    const s = tickMonth(state).stats;
    expect(s.debt).toBeCloseTo(40.211667, 5);
    expect(s.inflation).toBeCloseTo(2.9, 5);
    expect(s.feltInflation).toBeCloseTo(5.94, 5);
    expect(s.happiness).toBeCloseTo(68.436, 5);
  });

  it('month 3', () => {
    const s = tickTimes(state, 3).stats;
    expect(s.debt).toBeCloseTo(40.636487, 5);
    expect(s.inflation).toBeCloseTo(2.729, 5);
    expect(s.feltInflation).toBeCloseTo(5.8122, 5);
    expect(s.happiness).toBeCloseTo(65.606146, 5);
  });

  it('month 12 (a full year, unattended)', () => {
    const s = tickTimes(state, 12).stats;
    expect(s.debt).toBeCloseTo(42.571682, 4);
    expect(s.inflation).toBeCloseTo(2.28243, 4);
    expect(s.feltInflation).toBeCloseTo(5.26256, 4);
    expect(s.happiness).toBeCloseTo(57.057842, 4);
  });

  it('advances the calendar by one month and refills Executive Actions', () => {
    const next = tickMonth(state);
    expect(next.date).toEqual({ year: 2024, month: 2 });
    expect(next.actionsLeft).toBe(BALANCE.actionsPerMonth);
    expect(next.actionsUsedThisMonth).toEqual([]);
  });
});

describe('tickMonth: pending effects', () => {
  it('applies a pending effect due this month before the economy formulas run', () => {
    const state = {
      ...createInitialState(1),
      pending: [{ stat: 'debt' as const, amount: 5, inMonths: 1 }],
    };
    const next = tickMonth(state);
    // Roughly the no-pending month-1 debt (40.21) plus the 5 that came due.
    expect(next.stats.debt).toBeGreaterThan(45);
    expect(next.pending).toEqual([]);
  });

  it('keeps a not-yet-due pending effect queued, decremented by one month', () => {
    const state = {
      ...createInitialState(1),
      pending: [{ stat: 'debt' as const, amount: 5, inMonths: 3 }],
    };
    const next = tickMonth(state);
    expect(next.pending).toEqual([{ stat: 'debt', amount: 5, inMonths: 2 }]);
  });
});

describe('tickMonth: DEFCON calm recovery', () => {
  it('recovers by 1 after enough calm months, clamped at 5', () => {
    const state: GameState = {
      ...createInitialState(1),
      stats: { ...createInitialState(1).stats, defcon: 3 },
      defconMonthStart: 3,
      defconCalmStreak: BALANCE.economy.defconCalmMonths - 1,
    };
    const next = tickMonth(state);
    expect(next.stats.defcon).toBe(4);
    expect(next.defconCalmStreak).toBe(0);
    expect(next.defconMonthStart).toBe(4);
  });

  it('does not recover before the streak is long enough', () => {
    const state: GameState = {
      ...createInitialState(1),
      stats: { ...createInitialState(1).stats, defcon: 3 },
      defconMonthStart: 3,
      defconCalmStreak: 1,
    };
    const next = tickMonth(state);
    expect(next.stats.defcon).toBe(3);
    expect(next.defconCalmStreak).toBe(2);
  });

  it('resets the streak when DEFCON drops during the month', () => {
    const state: GameState = {
      ...createInitialState(1),
      stats: { ...createInitialState(1).stats, defcon: 3 },
      defconMonthStart: 5,
      defconCalmStreak: 3,
    };
    const next = tickMonth(state);
    expect(next.defconCalmStreak).toBe(0);
    expect(next.stats.defcon).toBe(3);
  });

  it('never recovers above 5', () => {
    const state = createInitialState(1); // defcon 5, monthStart 5
    const next = tickTimes(state, BALANCE.economy.defconCalmMonths * 3);
    expect(next.stats.defcon).toBe(5);
  });
});

describe('tickMonth: Congress and Impeachment', () => {
  it('loses Congress at the midterms check when Happiness is below the threshold', () => {
    const base = createInitialState(1);
    const state: GameState = {
      ...base,
      date: { ...BALANCE.calendar.midterms },
      stats: { ...base.stats, happiness: 30 },
    };
    const next = tickMonth(state);
    expect(next.midtermsChecked).toBe(true);
    expect(next.congressLost).toBe(true);
  });

  it('keeps Congress when Happiness is at or above the midterms threshold', () => {
    const base = createInitialState(1);
    const state: GameState = {
      ...base,
      date: { ...BALANCE.calendar.midterms },
      stats: { ...base.stats, happiness: 80 },
    };
    const next = tickMonth(state);
    expect(next.midtermsChecked).toBe(true);
    expect(next.congressLost).toBe(false);
  });

  it('checks the midterms only once', () => {
    const base = createInitialState(1);
    const alreadyChecked: GameState = {
      ...base,
      date: { ...BALANCE.calendar.midterms },
      midtermsChecked: true,
      congressLost: false,
      stats: { ...base.stats, happiness: 10 },
    };
    const next = tickMonth(alreadyChecked);
    expect(next.congressLost).toBe(false);
  });

  it('ends the run in Impeachment after enough low-happiness months post-midterms', () => {
    const base = createInitialState(1);
    const state: GameState = {
      ...base,
      congressLost: true,
      midtermsChecked: true,
      lowHappinessStreak: 2,
      stats: { ...base.stats, happiness: 10 },
    };
    const next = tickMonth(state);
    expect(next.lowHappinessStreak).toBe(3);
    expect(next.ending).toBe('impeachment');
  });

  it('resets the streak once Happiness recovers above the threshold', () => {
    const base = createInitialState(1);
    const state: GameState = {
      ...base,
      congressLost: true,
      midtermsChecked: true,
      lowHappinessStreak: 2,
      stats: { ...base.stats, happiness: 90 },
    };
    const next = tickMonth(state);
    expect(next.lowHappinessStreak).toBe(0);
  });
});

describe('tickMonth: survival and game over', () => {
  it('declares survival once the calendar moves past the final term month', () => {
    const base = createInitialState(1);
    const state: GameState = { ...base, date: { year: 2027, month: 12 } };
    const next = tickMonth(state);
    expect(next.date).toEqual({ year: 2028, month: 1 });
    expect(next.ending).toBe('survived');
  });

  it('is a no-op once the run has already ended', () => {
    const state: GameState = { ...createInitialState(1), ending: 'bankruptcy' };
    expect(tickMonth(state)).toBe(state);
  });
});

describe('tickMonth: Executive Action refill modifiers (GAME_PLAN §9)', () => {
  it('refills to the normal amount with no modifier flags set', () => {
    const state: GameState = { ...createInitialState(1), actionsLeft: 0 };
    const next = tickMonth(state);
    expect(next.actionsLeft).toBe(BALANCE.actionsPerMonth);
  });

  it("caps next month to 1 EA after a Government Shutdown ('shutdownPending')", () => {
    const state: GameState = {
      ...createInitialState(1),
      actionsLeft: 0,
      flags: ['shutdownPending'],
    };
    const next = tickMonth(state);
    expect(next.actionsLeft).toBe(1);
    expect(next.flags).not.toContain('shutdownPending');
  });

  it("grants +2 EA next month after an Executive Order Spree ('executiveOrderBonus')", () => {
    const state: GameState = {
      ...createInitialState(1),
      actionsLeft: 0,
      flags: ['executiveOrderBonus'],
    };
    const next = tickMonth(state);
    expect(next.actionsLeft).toBe(BALANCE.actionsPerMonth + 2);
    expect(next.flags).not.toContain('executiveOrderBonus');
  });

  it('lets a shutdown override a same-month bonus rather than netting them out', () => {
    const state: GameState = {
      ...createInitialState(1),
      actionsLeft: 0,
      flags: ['shutdownPending', 'executiveOrderBonus'],
    };
    const next = tickMonth(state);
    expect(next.actionsLeft).toBe(1);
    expect(next.flags).not.toContain('shutdownPending');
    expect(next.flags).not.toContain('executiveOrderBonus');
  });

  it('leaves unrelated flags untouched', () => {
    const state: GameState = {
      ...createInitialState(1),
      actionsLeft: 0,
      flags: ['shutdownPending', 'goldenDomeActive'],
    };
    const next = tickMonth(state);
    expect(next.flags).toEqual(['goldenDomeActive']);
  });
});
