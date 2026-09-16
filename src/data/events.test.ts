import { describe, expect, it } from 'vitest';
import { eligibleEvents, EVENTS, getEvent } from './events';

describe('EVENTS', () => {
  it('has 23 events with unique ids', () => {
    expect(EVENTS).toHaveLength(23);
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
  });

  it('keeps every weight positive', () => {
    for (const event of EVENTS) {
      expect(event.weight).toBeGreaterThan(0);
    }
  });

  it('requires at least one effect per event', () => {
    for (const event of EVENTS) {
      expect(event.effects.length).toBeGreaterThan(0);
    }
  });

  it('gates the reactor-inspection event behind the DOGE energy-cut flag', () => {
    expect(eligibleEvents([]).map((e) => e.id)).not.toContain('reactor_inspection');
    expect(eligibleEvents(['dogeCutEnergy']).map((e) => e.id)).toContain('reactor_inspection');
  });

  it('leaves every other event ungated', () => {
    const gated = EVENTS.filter((e) => e.requires?.flags && e.requires.flags.length > 0);
    expect(gated.map((e) => e.id)).toEqual(['reactor_inspection']);
  });

  it("makes Elon's sabotage events eligible only once he's rage-quit the cabinet", () => {
    const normal = eligibleEvents([]);
    expect(normal.some((e) => e.sabotage)).toBe(false);
    expect(normal.length).toBeGreaterThan(0);

    const enraged = eligibleEvents(['elonLeftCabinet']);
    expect(enraged.length).toBeGreaterThan(0);
    expect(enraged.every((e) => e.sabotage)).toBe(true);
  });

  it('marks exactly the three sabotage events', () => {
    const sabotage = EVENTS.filter((e) => e.sabotage);
    expect(sabotage.map((e) => e.id).sort()).toEqual([
      'doge_access_leak',
      'spacex_withdrawal',
      'starlink_outage',
    ]);
  });
});

describe('getEvent', () => {
  it('finds an event by id', () => {
    expect(getEvent('egg_shortage').id).toBe('egg_shortage');
  });

  it('throws for an unknown id', () => {
    expect(() => getEvent('nope')).toThrow();
  });
});
