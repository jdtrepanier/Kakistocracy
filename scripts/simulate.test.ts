/**
 * Vitest wrapper around `scripts/simulate.ts`'s balance simulator: runs both policies and
 * asserts their survival rates stay in a sane band (`yarn simulate` runs this, and it's
 * part of `yarn test`/`yarn verify` too — Vitest doesn't swallow the report's
 * `console.log` output, so the printed report still shows up alongside the assertions).
 */
import { describe, expect, it } from 'vitest';
import { ITERATIONS, printReport, simulate } from './simulate';

describe('balance simulator', () => {
  it('a random, inattentive player almost always loses', () => {
    const report = simulate('random', ITERATIONS);
    printReport(report);
    // A regression here means the game got too forgiving to need any attention at all.
    expect(report.survivalRate).toBeLessThan(0.2);
  });

  it('a cautious player, avoiding the reckless plays, usually survives but not always', () => {
    const report = simulate('cautious', ITERATIONS);
    printReport(report);
    // Neither trivial nor impossible: both bounds catch a balance change gone too far.
    expect(report.survivalRate).toBeGreaterThan(0.3);
    expect(report.survivalRate).toBeLessThan(0.95);
  });
});
