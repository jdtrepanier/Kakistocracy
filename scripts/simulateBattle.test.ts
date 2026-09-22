/**
 * Vitest wrapper around `scripts/simulateBattle.ts`'s tactical-battle balance simulator —
 * same shape as `scripts/simulate.test.ts` for the economy simulator. Exists to catch a
 * future stat change that makes a war target either trivial or, per the bug this
 * simulator was built to diagnose and fix, a literal lock against the player.
 */
import { describe, expect, it } from 'vitest';
import { ITERATIONS, printReport, simulate } from './simulateBattle';

describe('battle balance simulator', () => {
  it('Canada is genuinely hard but not a mathematical lock', () => {
    const report = simulate('canada', ITERATIONS);
    printReport(report);
    // Regression guard for the exact bug reported by a user ("it's almost impossible to
    // win a battle against Canada") and confirmed at 0.0% before the fix in
    // `data/battleRosters.ts` (Canada's `maxComposure` values halved).
    expect(report.usWins / report.iterations).toBeGreaterThan(0.2);
    // Still meant to be the hardest fight in the game — not a free win either.
    expect(report.usWins / report.iterations).toBeLessThan(0.7);
  });

  // One `it.each` case per country rather than one loop inside a single `it` — each
  // country's 2000-iteration simulation takes a couple of seconds on its own (Canada's own
  // sibling test above takes ~3s solo), so bundling all six into one test body used to
  // blow past Vitest's default 5000ms test timeout on an ordinary machine even though no
  // individual country was slow. Splitting them out gives each its own fresh timeout
  // budget and reports which specific country regressed instead of just "some country
  // failed."
  it.each(['greenland', 'panama', 'mexico', 'iran', 'venezuela', 'russia'] as const)(
    '%s stays clearly winnable',
    (country) => {
      const report = simulate(country, ITERATIONS);
      printReport(report);
      expect(report.usWins / report.iterations).toBeGreaterThan(0.7);
    },
  );
});
