import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('gives different sequences for different seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it('continues the same sequence when restored from its state', () => {
    const original = createRng(2024);
    original.next();
    original.next();
    const restored = createRng(original.state);
    expect(restored.next()).toBe(original.next());
  });

  it('keeps next() in [0, 1) and int() within bounds', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const f = rng.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = rng.int(1, 6);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(6);
      expect(Number.isInteger(n)).toBe(true);
    }
  });

  it('hits every face of a die over many rolls', () => {
    const rng = createRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rng.int(1, 6));
    expect(seen.size).toBe(6);
  });

  it('respects chance() extremes', () => {
    const rng = createRng(3);
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
  });

  it('picks from a list and rejects empty lists', () => {
    const rng = createRng(5);
    const items = ['rename', 'tariff', 'rocket'] as const;
    expect(items).toContain(rng.pick(items));
    expect(() => rng.pick([])).toThrow();
    expect(() => rng.int(5, 1)).toThrow();
  });
});
