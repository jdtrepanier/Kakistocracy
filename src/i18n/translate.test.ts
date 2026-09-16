import { describe, expect, it } from 'vitest';
import { en } from './en';
import { fr } from './fr';
import { monthKey, translate } from './translate';

describe('translate', () => {
  it('returns strings in each language', () => {
    expect(translate('en', 'hud.debt')).toBe('DEBT');
    expect(translate('fr', 'hud.debt')).toBe('DETTE');
  });

  it('fills placeholders', () => {
    expect(translate('en', 'hud.termYear', { n: 2 })).toBe('Year 2 of 4');
    expect(translate('fr', 'hud.termYear', { n: 3 })).toBe('Année 3 sur 4');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(translate('en', 'hud.termYear', { other: 1 })).toBe('Year {n} of 4');
  });

  it('has the same keys in English and French', () => {
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  });

  it('has no empty strings', () => {
    for (const value of [...Object.values(en), ...Object.values(fr)]) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });

  it('maps month numbers to keys', () => {
    expect(translate('en', monthKey(1))).toBe('JAN');
    expect(translate('fr', monthKey(8))).toBe('AOÛT');
    expect(() => monthKey(13)).toThrow();
  });
});
