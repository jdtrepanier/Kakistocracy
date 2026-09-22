import { describe, expect, it } from 'vitest';
import { CHARACTERS, displayName, getCharacter, parseCharacterDef, shortName } from './characters';

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

describe('characters/us.json validation (parseCharacterDef)', () => {
  // Backed by data/characters/us.json now (user request: "Each character's information
  // should also be in a json file"), merged with battleRosters.ts's combat stats in the
  // same file — this only reads the display fields back out. Same "fail loudly, name the
  // exact bad field" promise as data/battlegrounds.ts's parseGrid, exercised directly here
  // with synthetic bad input.
  const validRaw = {
    id: 'trump',
    name: { real: 'Donald Trump', parody: 'The Chaos King' },
    short: { real: 'TRUMP', parody: 'KING' },
    placeholder: { initials: 'DT', color: '#c8323c' },
    sprite: {
      front: '/assets/sprites/us/trump-front.png',
      back: '/assets/sprites/us/trump-back.png',
      left: '/assets/sprites/us/trump-left.png',
      right: '/assets/sprites/us/trump-right.png',
    },
    // Extra battle-stat fields (only meaningful to battleRosters.ts) are ignored here,
    // not rejected — us.json's entries carry both display and stats in one object.
    move: 2,
    range: 1,
    power: 5,
    maxComposure: 16,
    fleeChance: 0.6,
  };

  it('parses a well-formed, merged us.json entry, ignoring the battle-stat fields', () => {
    expect(parseCharacterDef(validRaw, 'test')).toEqual({
      id: 'trump',
      name: { real: 'Donald Trump', parody: 'The Chaos King' },
      short: { real: 'TRUMP', parody: 'KING' },
      placeholder: { initials: 'DT', color: '#c8323c' },
      sprite: validRaw.sprite,
    });
  });

  it('rejects an id that is not one of the 6 known CharacterIds', () => {
    expect(() => parseCharacterDef({ ...validRaw, id: 'not-a-real-official' }, 'test')).toThrow(
      /not a known CharacterId/,
    );
  });

  it('rejects a name/short missing the parody mode', () => {
    expect(() =>
      parseCharacterDef({ ...validRaw, name: { real: 'Donald Trump' } }, 'test'),
    ).toThrow(/"name"/);
  });

  it('rejects a sprite missing one of the 4 required poses', () => {
    const { right: _right, ...partialSprite } = validRaw.sprite;
    expect(() => parseCharacterDef({ ...validRaw, sprite: partialSprite }, 'test')).toThrow(
      /"sprite"/,
    );
  });
});
