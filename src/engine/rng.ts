/**
 * Small seeded random number generator (mulberry32).
 * All randomness in the engine goes through this, so a run can be replayed from its seed
 * and tests are deterministic. `Math.random` is banned in engine/ by ESLint.
 */
export interface Rng {
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  /** True with probability `p` (0–1). */
  chance(p: number): boolean;
  /** Random element of a non-empty list. */
  pick<T>(items: readonly T[]): T;
  /** Internal state. Save it and call `createRng(state)` to continue the same sequence. */
  readonly state: number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min, max) {
      if (max < min) throw new Error(`rng.int: max (${max}) < min (${min})`);
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(p) {
      return next() < p;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('rng.pick: empty list');
      return items[Math.floor(next() * items.length)] as T;
    },
    get state() {
      return state;
    },
  };
}
