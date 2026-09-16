import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/data/balance';
import { EVENTS } from '@/data/events';
import { rollMonthlyEvent } from './events';
import { createInitialState } from './state';
import type { GameState } from './types';

describe('rollMonthlyEvent', () => {
  it('is a no-op once the run has already ended', () => {
    const state: GameState = { ...createInitialState(1), ending: 'bankruptcy' };
    const { state: next, outcome } = rollMonthlyEvent(state);
    expect(next).toBe(state);
    expect(outcome).toBeNull();
  });

  it('always picks one of the real, data-defined events', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { outcome } = rollMonthlyEvent(createInitialState(seed));
      expect(outcome).not.toBeNull();
      expect(EVENTS.some((e) => e.id === outcome?.event.id)).toBe(true);
    }
  });

  it('rolls more than one distinct event across many seeds (it is actually random)', () => {
    const ids = new Set<string>();
    for (let seed = 1; seed <= 300; seed++) {
      const { outcome } = rollMonthlyEvent(createInitialState(seed));
      if (outcome) ids.add(outcome.event.id);
    }
    expect(ids.size).toBeGreaterThan(5);
  });

  it('never rolls the flag-gated reactor-inspection event before its flag is set', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const { outcome } = rollMonthlyEvent(createInitialState(seed));
      expect(outcome?.event.id).not.toBe('reactor_inspection');
    }
  });

  it('can roll the reactor-inspection event once its flag is set', () => {
    let found = false;
    for (let seed = 1; seed <= 3000; seed++) {
      const flagged: GameState = { ...createInitialState(seed), flags: ['dogeCutEnergy'] };
      const { outcome } = rollMonthlyEvent(flagged);
      if (outcome?.event.id === 'reactor_inspection') {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("never rolls one of Elon's sabotage events before he's rage-quit", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { outcome } = rollMonthlyEvent(createInitialState(seed));
      const event = EVENTS.find((e) => e.id === outcome?.event.id);
      expect(event?.sabotage).not.toBe(true);
    }
  });

  it('only rolls sabotage events once elonLeftCabinet is set', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const enraged: GameState = { ...createInitialState(seed), flags: ['elonLeftCabinet'] };
      const { outcome } = rollMonthlyEvent(enraged);
      expect(outcome).not.toBeNull();
      const event = EVENTS.find((e) => e.id === outcome?.event.id);
      expect(event?.sabotage).toBe(true);
    }
  });

  it('advances the RNG state so a replayed run never repeats the same roll', () => {
    const base = createInitialState(1);
    const { state } = rollMonthlyEvent(base);
    expect(state.rngState).not.toBe(base.rngState);
  });

  it("applies a specific event's effects when it comes up (egg shortage: feltInflation +1)", () => {
    let seed = 1;
    let hit: ReturnType<typeof rollMonthlyEvent> | null = null;
    let base: GameState = createInitialState(1);
    for (; seed <= 200; seed++) {
      base = createInitialState(seed);
      const result = rollMonthlyEvent(base);
      if (result.outcome?.event.id === 'egg_shortage') {
        hit = result;
        break;
      }
    }
    expect(hit).not.toBeNull();
    expect(hit?.state.stats.feltInflation).toBeCloseTo(base.stats.feltInflation + 1, 10);
  });

  it("checks endings immediately when an event's effects cross a threshold", () => {
    let seed = 1;
    let ended: ReturnType<typeof rollMonthlyEvent> | null = null;
    for (; seed <= 500; seed++) {
      const base = createInitialState(seed);
      const nearMeltdown: GameState = { ...base, stats: { ...base.stats, defcon: 2 } };
      const result = rollMonthlyEvent(nearMeltdown, BALANCE);
      if (result.outcome && result.state.stats.defcon <= BALANCE.thresholds.meltdownDefcon) {
        ended = result;
        break;
      }
    }
    expect(ended).not.toBeNull();
    expect(ended?.state.ending).toBe('nuclear');
  });
});
