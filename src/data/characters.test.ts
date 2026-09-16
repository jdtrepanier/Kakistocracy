import { describe, expect, it } from 'vitest';
import { CHARACTERS, displayName, getCharacter, shortName } from './characters';

describe('characters (name layer)', () => {
  it('has the six playable officials', () => {
    expect(CHARACTERS.map((c) => c.id)).toEqual([
      'trump',
      'vance',
      'bessent',
      'lutnick',
      'melania',
      'musk',
    ]);
  });

  it('keeps short names within 8 characters so they fit the HUD', () => {
    for (const c of CHARACTERS) {
      expect(c.short.real.length).toBeLessThanOrEqual(8);
      expect(c.short.parody.length).toBeLessThanOrEqual(8);
    }
  });

  it('switches between real and parody names', () => {
    expect(displayName('lutnick', 'real')).toBe('Howard Lutnick');
    expect(displayName('lutnick', 'parody')).toBe('The Tariff Paladin');
    expect(shortName('bessent', 'parody')).toBe('SORCERER');
    expect(getCharacter('musk').placeholder.initials).toBe('EM');
  });
});
