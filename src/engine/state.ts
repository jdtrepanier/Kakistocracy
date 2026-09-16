import { BALANCE, type Balance } from '@/data/balance';
import { createRng } from './rng';
import type { GameState } from './types';

/** A fresh run: JAN 2024, starting stats, full Executive Actions, empty history. */
export function createInitialState(seed: number, balance: Balance = BALANCE): GameState {
  const normalizedSeed = seed >>> 0;
  return {
    seed: normalizedSeed,
    rngState: createRng(normalizedSeed).state,
    date: { ...balance.calendar.start },
    stats: { ...balance.start },
    actionsLeft: balance.actionsPerMonth,
    actionsUsedThisMonth: [],
    feltInflationRevealed: false,
    pending: [],
    flags: [],
    atWarWith: [],
    countriesOwned: [],
    history: [],
    defconMonthStart: balance.start.defcon,
    defconCalmStreak: 0,
    midtermsChecked: false,
    congressLost: false,
    lowHappinessStreak: 0,
    elonRage: 0,
    ending: null,
  };
}
