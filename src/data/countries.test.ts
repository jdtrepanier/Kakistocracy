import { describe, expect, it } from 'vitest';
import type { Rng } from '@/engine/rng';
import { COUNTRIES, US_COLOR, getCountry, pickRandomCountry } from './countries';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** A fake RNG whose pick() always returns the first candidate, for deterministic tests. */
function firstPickRng(): Rng {
  return {
    next: () => 0,
    int: () => 0,
    chance: () => true,
    pick: (items) => items[0] as never,
    state: 0,
  };
}

describe('COUNTRIES', () => {
  it('has unique ids', () => {
    expect(new Set(COUNTRIES.map((c) => c.id)).size).toBe(COUNTRIES.length);
  });

  it('places every marker inside the map box', () => {
    for (const country of COUNTRIES) {
      expect(country.mapX).toBeGreaterThanOrEqual(0);
      expect(country.mapX).toBeLessThanOrEqual(100);
      expect(country.mapY).toBeGreaterThanOrEqual(0);
      expect(country.mapY).toBeLessThanOrEqual(100);
    }
  });

  it('has at least one war target and one purchasable country', () => {
    expect(COUNTRIES.some((c) => c.warTarget)).toBe(true);
    expect(COUNTRIES.some((c) => c.purchasable)).toBe(true);
  });

  it('gives every country a valid hex color, distinct from every other country and from US_COLOR', () => {
    const colors = COUNTRIES.map((c) => c.color);
    for (const color of colors) {
      expect(color).toMatch(HEX_COLOR);
    }
    expect(new Set(colors).size).toBe(colors.length);
    expect(colors).not.toContain(US_COLOR);
  });

  it('gives US_COLOR a valid hex color too', () => {
    expect(US_COLOR).toMatch(HEX_COLOR);
  });
});

describe('getCountry', () => {
  it('finds a country by id', () => {
    expect(getCountry('canada').id).toBe('canada');
  });

  it('finds each of the war-only additions', () => {
    expect(getCountry('iran').warTarget).toBe(true);
    expect(getCountry('venezuela').warTarget).toBe(true);
    expect(getCountry('russia').warTarget).toBe(true);
    expect(getCountry('iran').purchasable).toBe(false);
    expect(getCountry('venezuela').purchasable).toBe(false);
    expect(getCountry('russia').purchasable).toBe(false);
  });

  it('throws for an unknown id', () => {
    // @ts-expect-error -- deliberately not a real CountryId, to test the error path.
    expect(() => getCountry('narnia')).toThrow();
  });
});

describe('pickRandomCountry', () => {
  it('picks the first eligible candidate under a deterministic RNG', () => {
    expect(pickRandomCountry([], (c) => c.warTarget, firstPickRng())).toBe('canada');
  });

  it('skips countries already taken', () => {
    expect(pickRandomCountry(['canada'], (c) => c.warTarget, firstPickRng())).toBe('greenland');
  });

  it('respects the eligibility predicate', () => {
    expect(pickRandomCountry([], (c) => c.purchasable, firstPickRng())).toBe('canada');
    expect(
      pickRandomCountry(['canada', 'greenland', 'panama'], (c) => c.purchasable, firstPickRng()),
    ).toBeNull();
  });

  it('returns null once every eligible country is taken', () => {
    const everyWarTarget = COUNTRIES.filter((c) => c.warTarget).map((c) => c.id);
    expect(pickRandomCountry(everyWarTarget, (c) => c.warTarget, firstPickRng())).toBeNull();
  });
});
