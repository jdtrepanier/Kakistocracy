import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/data/balance';
import { computeRank } from './scoring';

describe('computeRank', () => {
  it('ranks by total Headlines against the balance thresholds', () => {
    expect(computeRank(0, BALANCE)).toBe('forgettable');
    expect(computeRank(999, BALANCE)).toBe('forgettable');
    expect(computeRank(1000, BALANCE)).toBe('memorable');
    expect(computeRank(2499, BALANCE)).toBe('memorable');
    expect(computeRank(2500, BALANCE)).toBe('historic');
    expect(computeRank(4999, BALANCE)).toBe('historic');
    expect(computeRank(5000, BALANCE)).toBe('legendary');
    expect(computeRank(50_000, BALANCE)).toBe('legendary');
  });
});
