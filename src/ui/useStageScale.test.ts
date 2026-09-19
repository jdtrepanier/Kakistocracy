import { describe, expect, it } from 'vitest';
import { computeStageScale } from './useStageScale';

describe('computeStageScale', () => {
  it('fills the window exactly when it matches the stage aspect ratio', () => {
    // 480×270 is 16:9 — a 1920×1080 window is the same ratio, so both axes agree.
    expect(computeStageScale(1920, 1080)).toBe(4);
  });

  it('returns the exact (fractional) fit, not the nearest whole number below it', () => {
    // Real user feedback: "the game should take all the screen, it's too dense" — this
    // used to floor down to 3, wasting the ~15% of the window between 3x and the real
    // 3.15x fit. A 1512x944 window is width-constrained: 1512/480 = 3.15, 944/270 ≈ 3.496.
    expect(computeStageScale(1512, 944)).toBeCloseTo(3.15, 5);
    // 1366×768 is one of the single most common laptop resolutions — used to floor all
    // the way down to 2×, when the real fit is closer to 2.84×. This is a moved-and-
    // updated case from `format.test.ts`, which used to test this same function (moved
    // here per this repo's "tests colocated with the code" convention — `format.ts`
    // doesn't define `computeStageScale`, `useStageScale.ts` does).
    expect(computeStageScale(1366, 768)).toBeCloseTo(2.8444444444444446, 10);
  });

  it('fits exactly at 1x when the window matches the stage size exactly', () => {
    expect(computeStageScale(480, 270)).toBe(1);
  });

  it('is constrained by whichever axis is tighter (height here)', () => {
    // 480x270 wide and short: width allows 10x (4800/480), height only 5x (1350/270).
    expect(computeStageScale(4800, 1350)).toBe(5);
  });

  it('shrinks below 1x on a window smaller than the stage, same as before', () => {
    expect(computeStageScale(240, 135)).toBeCloseTo(0.5, 5);
    // A tall, narrow window (portrait phone) — width-constrained: 400/480 ≈ 0.833, vs.
    // 800/270 ≈ 2.96 for height. Moved from `format.test.ts` (see the comment above).
    expect(computeStageScale(400, 800)).toBeCloseTo(400 / 480, 10);
  });

  it('falls back to 1 for a degenerate (zero/negative) viewport', () => {
    expect(computeStageScale(0, 0)).toBe(1);
    expect(computeStageScale(-100, 500)).toBe(1);
  });

  it('accepts a custom stage size', () => {
    expect(computeStageScale(200, 200, 100, 50)).toBe(2); // width-constrained: min(2, 4)
  });
});
