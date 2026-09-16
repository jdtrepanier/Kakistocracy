import type { GameDate, NationStats, StatKey } from '@/engine/types';

/**
 * Every tunable number lives here, never hard-coded in the engine.
 * Difficulty modes (Intern / Normal / Third Term) will be variants of this object.
 * See docs/GAME_PLAN.md §3, §4 and §6.
 */
export interface Balance {
  readonly calendar: {
    readonly start: GameDate;
    readonly termMonths: number;
    readonly midterms: GameDate & { readonly happinessNeeded: number };
  };
  readonly start: NationStats;
  readonly actionsPerMonth: number;
  readonly thresholds: {
    /** Debt at or above this → Bankruptcy. */
    readonly bankruptcyDebt: number;
    /** Felt inflation at or above this → Hyperinflation. */
    readonly hyperinflationFelt: number;
    /** Party IQ at or below this → Brain Freeze. */
    readonly brainFreezeIq: number;
    /** Happiness at or below this → American Revolt. */
    readonly revoltHappiness: number;
    /** DEFCON at or below this → Nuclear Meltdown. */
    readonly meltdownDefcon: number;
    /** Happiness below this at a month-end, after Congress is lost, counts toward Impeachment. */
    readonly impeachmentHappiness: number;
    /** Consecutive months at/under `impeachmentHappiness` (post-midterms) → Impeachment. */
    readonly impeachmentStreakMonths: number;
  };
  /** Min/max every stat is clamped to after any effect (docs §4 "Range" column). */
  readonly statBounds: Readonly<Record<StatKey, { readonly min: number; readonly max: number }>>;
  /**
   * Repeating the same action within 6 months earns less: index 0 = first time this
   * "recent" window, index 1 = second time, etc. The last entry repeats for further reps.
   */
  readonly headlineDiminishing: readonly number[];
  /** Months counted as "recent" for diminishing headlines. */
  readonly headlineDiminishingWindowMonths: number;
  /** Failed actions still earn the news, just less of it: base headlines × this ratio. */
  readonly failHeadlinesRatio: number;
  /** Total Headlines needed for the Memorable, Historic and Legendary Chaos ranks. */
  readonly rankThresholds: readonly number[];
  readonly economy: {
    readonly primaryDeficitPerMonth: number;
    readonly yieldSpread: number;
    readonly debtPremiumStart: number;
    readonly debtPremiumPerTrillion: number;
    readonly inflationPremiumStart: number;
    readonly inflationPremiumPerPoint: number;
    readonly inflationBase: number;
    readonly neutralRate: number;
    readonly rateSensitivity: number;
    readonly inflationDrift: number;
    readonly feltGap: number;
    readonly feltDrift: number;
    readonly happinessPainStart: number;
    readonly happinessPricePain: number;
    readonly happinessAnchor: number;
    readonly happinessReversion: number;
    readonly defconCalmMonths: number;
  };
}

export const BALANCE: Balance = {
  calendar: {
    start: { year: 2024, month: 1 },
    termMonths: 48,
    midterms: { year: 2026, month: 11, happinessNeeded: 45 },
  },
  start: {
    debt: 40,
    interestRate: 3.5,
    inflation: 3,
    feltInflation: 6,
    iq: 80,
    happiness: 70,
    defcon: 5,
    headlines: 0,
  },
  actionsPerMonth: 3,
  thresholds: {
    bankruptcyDebt: 60,
    hyperinflationFelt: 25,
    brainFreezeIq: 0,
    revoltHappiness: 0,
    meltdownDefcon: 1,
    impeachmentHappiness: 25,
    impeachmentStreakMonths: 3,
  },
  statBounds: {
    debt: { min: 0, max: Number.POSITIVE_INFINITY },
    interestRate: { min: 0, max: 12 },
    inflation: { min: -2, max: 20 },
    feltInflation: { min: -2, max: 30 },
    iq: { min: 0, max: 150 },
    happiness: { min: 0, max: 100 },
    defcon: { min: 1, max: 5 },
    headlines: { min: 0, max: Number.POSITIVE_INFINITY },
  },
  headlineDiminishing: [1, 0.5, 0.25, 0.1],
  headlineDiminishingWindowMonths: 6,
  failHeadlinesRatio: 0.35,
  rankThresholds: [1000, 2500, 5000],
  economy: {
    primaryDeficitPerMonth: 0.06,
    yieldSpread: 0.75,
    debtPremiumStart: 45,
    debtPremiumPerTrillion: 0.05,
    inflationPremiumStart: 4,
    inflationPremiumPerPoint: 0.15,
    inflationBase: 2,
    neutralRate: 3.5,
    rateSensitivity: 0.6,
    inflationDrift: 0.1,
    feltGap: 2.5,
    feltDrift: 0.1,
    happinessPainStart: 4,
    happinessPricePain: 0.6,
    happinessAnchor: 60,
    happinessReversion: 0.04,
    defconCalmMonths: 4,
  },
};

export type DifficultyId = 'intern' | 'normal' | 'thirdTerm';

export const DEFAULT_DIFFICULTY: DifficultyId = 'normal';

/**
 * Difficulty modes (roadmap item, GAME_PLAN §3/§4/§6's "will be variants of this
 * object" above). Each nudges a handful of `BALANCE`'s knobs — how many Executive
 * Actions land each month, how fast the debt/inflation formulas bite, and how much
 * room the ending thresholds give before a run is over — rather than redefining the
 * whole object, so the underlying formulas in `engine/economy.ts`/`engine/endings.ts`
 * stay identical across every difficulty; only how forgiving they are changes.
 * `normal` is `BALANCE` itself unchanged, so every existing call site and test that
 * already defaults to `BALANCE` keeps behaving exactly as before this was added.
 */
export const BALANCES: Readonly<Record<DifficultyId, Balance>> = {
  intern: {
    ...BALANCE,
    actionsPerMonth: 4,
    thresholds: {
      ...BALANCE.thresholds,
      bankruptcyDebt: 75,
      hyperinflationFelt: 30,
      impeachmentStreakMonths: 4,
    },
    economy: {
      ...BALANCE.economy,
      primaryDeficitPerMonth: 0.04,
      debtPremiumPerTrillion: 0.035,
      inflationPremiumPerPoint: 0.1,
    },
  },
  normal: BALANCE,
  thirdTerm: {
    ...BALANCE,
    actionsPerMonth: 2,
    thresholds: {
      ...BALANCE.thresholds,
      bankruptcyDebt: 50,
      hyperinflationFelt: 20,
      impeachmentStreakMonths: 2,
    },
    economy: {
      ...BALANCE.economy,
      primaryDeficitPerMonth: 0.09,
      debtPremiumPerTrillion: 0.07,
      inflationPremiumPerPoint: 0.2,
    },
  },
};

export function getBalance(id: DifficultyId): Balance {
  return BALANCES[id];
}
