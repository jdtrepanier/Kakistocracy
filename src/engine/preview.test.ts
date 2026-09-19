import { describe, expect, it } from 'vitest';
import type { Effect } from './types';
import { summarizeEffects } from './preview';

describe('summarizeEffects', () => {
  it('sums delta effects as immediate', () => {
    const effects: Effect[] = [
      { kind: 'delta', stat: 'debt', amount: 1.5 },
      { kind: 'delta', stat: 'debt', amount: 0.5 },
      { kind: 'delta', stat: 'happiness', amount: 10 },
    ];
    const summary = summarizeEffects(effects);
    expect(summary.immediate).toEqual({ debt: 2, happiness: 10 });
    expect(summary.overTime).toEqual({});
  });

  it('sums spread and delayed effects as overTime, not immediate', () => {
    const effects: Effect[] = [
      { kind: 'spread', stat: 'inflation', amount: 1.5, months: 6 },
      { kind: 'delayed', stat: 'debt', amount: 1.95, inMonths: 4 },
    ];
    const summary = summarizeEffects(effects);
    expect(summary.immediate).toEqual({});
    expect(summary.overTime).toEqual({ inflation: 1.5, debt: 1.95 });
  });

  it('walks into a chance effect\'s "then" branch and flags hasChance', () => {
    const effects: Effect[] = [
      {
        kind: 'chance',
        p: 0.5,
        then: [{ kind: 'delta', stat: 'happiness', amount: 1 }],
        else: [{ kind: 'delta', stat: 'happiness', amount: -1 }],
      },
    ];
    const summary = summarizeEffects(effects);
    expect(summary.immediate).toEqual({ happiness: 1 });
    expect(summary.hasChance).toBe(true);
  });

  it('flags hasRandomCountry for declareWar and purchaseCountry, without a stat delta', () => {
    const summary = summarizeEffects([
      { kind: 'declareWar' },
      { kind: 'delta', stat: 'iq', amount: -5 },
    ]);
    expect(summary.hasRandomCountry).toBe(true);
    expect(summary.immediate).toEqual({ iq: -5 });

    expect(summarizeEffects([{ kind: 'purchaseCountry' }]).hasRandomCountry).toBe(true);
  });

  it('flags hasRandomLandmark for renameLandmark, without a stat delta', () => {
    const summary = summarizeEffects([
      { kind: 'renameLandmark' },
      { kind: 'delta', stat: 'iq', amount: -2 },
    ]);
    expect(summary.hasRandomLandmark).toBe(true);
    expect(summary.immediate).toEqual({ iq: -2 });
  });

  it('ignores a substituted declareWarOn/renameLandmarkOn (never appears in raw preview data)', () => {
    const summary = summarizeEffects([
      { kind: 'declareWarOn', country: 'canada' },
      { kind: 'renameLandmarkOn', landmark: 'denali' },
    ]);
    expect(summary.hasRandomCountry).toBe(false);
    expect(summary.hasRandomLandmark).toBe(false);
  });

  it('ignores flag, unflag and rage effects', () => {
    const summary = summarizeEffects([
      { kind: 'flag', set: 'x' },
      { kind: 'unflag', clear: 'x' },
      { kind: 'rage', amount: 10 },
    ]);
    expect(summary.immediate).toEqual({});
    expect(summary.overTime).toEqual({});
    expect(summary.hasChance).toBe(false);
    expect(summary.hasRandomCountry).toBe(false);
    expect(summary.hasRandomLandmark).toBe(false);
  });

  it('returns empty, all-false summary for no effects', () => {
    expect(summarizeEffects([])).toEqual({
      immediate: {},
      overTime: {},
      hasChance: false,
      hasRandomCountry: false,
      hasRandomLandmark: false,
    });
  });
});
