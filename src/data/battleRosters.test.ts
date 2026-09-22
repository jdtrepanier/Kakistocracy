import { describe, expect, it } from 'vitest';
import { COUNTRIES } from './countries';
import {
  BATTLE_ROSTERS,
  US_BATTLE_UNITS,
  getBattleRoster,
  loadRoster,
  loadUsUnits,
} from './battleRosters';
import { ENEMY_SPAWN_POSITIONS } from './battlefield';

describe('US_BATTLE_UNITS', () => {
  it('has combat stats for every character, keyed by their own id, with no nameKey', () => {
    for (const [id, unit] of Object.entries(US_BATTLE_UNITS)) {
      expect(unit.id).toBe(id);
      expect(unit.nameKey).toBeUndefined();
      expect(unit.maxComposure).toBeGreaterThan(0);
      expect(unit.move).toBeGreaterThan(0);
      expect(unit.power).toBeGreaterThan(0);
    }
  });
});

describe('BATTLE_ROSTERS', () => {
  it('has a roster for every war-eligible country', () => {
    for (const country of COUNTRIES.filter((c) => c.warTarget)) {
      expect(BATTLE_ROSTERS[country.id].length).toBeGreaterThan(0);
    }
  });

  it('gives every enemy unit a nameKey and positive stats', () => {
    for (const roster of Object.values(BATTLE_ROSTERS)) {
      for (const unit of roster) {
        expect(unit.nameKey).toBeDefined();
        expect(unit.maxComposure).toBeGreaterThan(0);
        expect(unit.move).toBeGreaterThan(0);
        expect(unit.power).toBeGreaterThan(0);
      }
    }
  });

  it('has unique unit ids within each roster and across rosters', () => {
    const allIds = Object.values(BATTLE_ROSTERS).flatMap((roster) => roster.map((u) => u.id));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("doesn't exceed the battlefield's enemy spawn capacity", () => {
    // Checked against the real `ENEMY_SPAWN_POSITIONS.length`, not a hardcoded "7" —
    // `battlefield.test.ts` has the fuller version of this same invariant (plus the US
    // side); kept here too as a second, independent check from the roster's own test
    // file, same belt-and-suspenders reasoning as testing a shared invariant from both
    // sides of it.
    for (const roster of Object.values(BATTLE_ROSTERS)) {
      expect(roster.length).toBeLessThanOrEqual(ENEMY_SPAWN_POSITIONS.length);
    }
  });

  it('gives every unit quirk/magic chance a valid 0–1 probability, and every magic pool a positive max', () => {
    const allUnits = [
      ...Object.values(US_BATTLE_UNITS),
      ...Object.values(BATTLE_ROSTERS).flatMap((roster) => roster),
    ];
    for (const unit of allUnits) {
      for (const chance of [
        unit.fleeChance,
        unit.selfHitChance,
        unit.backstabChance,
        unit.dodgeChance,
        unit.magic?.chance,
      ]) {
        if (chance !== undefined) {
          expect(chance).toBeGreaterThan(0);
          expect(chance).toBeLessThanOrEqual(1);
        }
      }
      if (unit.magic) {
        expect(unit.magic.max).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('gives Trump, Vance, Carney, Miller, LeBlanc, Melania and Trudeau their requested quirks', () => {
    expect(US_BATTLE_UNITS.trump.fleeChance).toBe(0.6);
    expect(US_BATTLE_UNITS.vance.selfHitChance).toBe(0.2);
    expect(US_BATTLE_UNITS.melania.isWoman).toBe(true);
    expect(US_BATTLE_UNITS.melania.magic?.kind).toBe('sorcerer');

    const canada = BATTLE_ROSTERS.canada;
    const carney = canada.find((u) => u.id === 'canada-carney');
    const trudeau = canada.find((u) => u.id === 'canada-trudeau');
    const miller = canada.find((u) => u.id === 'canada-miller');
    const leblanc = canada.find((u) => u.id === 'canada-leblanc');
    const sugarShackGuy = canada.find((u) => u.id === 'canada-sugar-shack-guy');

    expect(carney?.magic?.kind).toBe('charm');
    expect(trudeau?.healsFromWomen).toBe(true);
    expect(miller?.backstabChance).toBe(0.5);
    expect(leblanc?.dodgeChance).toBe(0.5);

    // High HP (Carney) < Really high HP (the wildcard) < neither above the other's
    // baseline-plus-quirk siblings, and Low HP (Trudeau) below the roster's baseline.
    expect(carney?.maxComposure).toBeGreaterThan(miller?.maxComposure ?? 0);
    expect(sugarShackGuy?.maxComposure).toBeGreaterThan(carney?.maxComposure ?? 0);
    expect(trudeau?.maxComposure).toBeLessThan(miller?.maxComposure ?? 0);
  });
});

describe('getBattleRoster', () => {
  it('returns the matching roster', () => {
    expect(getBattleRoster('canada')).toBe(BATTLE_ROSTERS.canada);
    expect(getBattleRoster('canada')).toHaveLength(7);
  });
});

describe('character JSON validation (loadRoster/loadUsUnits)', () => {
  // Both US_BATTLE_UNITS and BATTLE_ROSTERS now come from data/characters/*.json (user
  // request: "Each character's information should also be in a json file") — these
  // exercise the loader's own error paths directly with synthetic bad input, the same
  // "fail loudly, name the exact bad field" promise data/battlegrounds.test.ts already
  // checks for map layouts.
  const validEnemyUnit = {
    id: 'test-unit',
    nameKey: 'battle.unit.canada.carney', // any real key works for this test
    move: 2,
    range: 1,
    power: 3,
    maxComposure: 10,
    placeholder: { initials: 'TU', color: '#123456' },
  };

  it('loadRoster accepts a well-formed roster', () => {
    const roster = loadRoster([validEnemyUnit], 'canada');
    expect(roster).toEqual([validEnemyUnit]);
  });

  it('loadRoster rejects an unknown nameKey', () => {
    expect(() => loadRoster([{ ...validEnemyUnit, nameKey: 'not.a.real.key' }], 'canada')).toThrow(
      /not a known message key/,
    );
  });

  it('loadRoster rejects a non-positive stat', () => {
    expect(() => loadRoster([{ ...validEnemyUnit, power: 0 }], 'canada')).toThrow(/"power"/);
    expect(() => loadRoster([{ ...validEnemyUnit, maxComposure: -1 }], 'canada')).toThrow(
      /"maxComposure"/,
    );
  });

  it('loadRoster rejects a quirk chance outside (0, 1]', () => {
    expect(() => loadRoster([{ ...validEnemyUnit, dodgeChance: 0 }], 'canada')).toThrow(
      /"dodgeChance"/,
    );
    expect(() => loadRoster([{ ...validEnemyUnit, fleeChance: 1.5 }], 'canada')).toThrow(
      /"fleeChance"/,
    );
    // Exactly 1 is allowed (an always-triggers quirk is a legitimate design, unlike 0).
    expect(loadRoster([{ ...validEnemyUnit, fleeChance: 1 }], 'canada')[0]?.fleeChance).toBe(1);
  });

  it('loadRoster rejects an unknown magic kind', () => {
    expect(() =>
      loadRoster(
        [{ ...validEnemyUnit, magic: { kind: 'necromancy', max: 3, chance: 0.5 } }],
        'canada',
      ),
    ).toThrow(/"kind"/);
  });

  it('loadRoster accepts a sprite with only "front" (Singh/Greenland-style partial art)', () => {
    const roster = loadRoster(
      [{ ...validEnemyUnit, sprite: { front: '/assets/sprites/canada/singh-front.png' } }],
      'canada',
    );
    expect(roster[0]?.sprite).toEqual({ front: '/assets/sprites/canada/singh-front.png' });
  });

  it('loadRoster rejects a sprite missing "front"', () => {
    expect(() => loadRoster([{ ...validEnemyUnit, sprite: { back: '/x.png' } }], 'canada')).toThrow(
      /"sprite"/,
    );
  });

  it('loadUsUnits rejects an id that is not one of the 6 known CharacterIds', () => {
    const validUsUnit = {
      id: 'trump',
      move: 2,
      range: 1,
      power: 5,
      maxComposure: 16,
      placeholder: { initials: 'DT', color: '#c8323c' },
    };
    expect(() => loadUsUnits([{ ...validUsUnit, id: 'not-a-real-official' }])).toThrow(
      /not a known CharacterId/,
    );
  });

  it('loadUsUnits rejects a us.json missing one of the 6 officials', () => {
    const oneUnit = {
      id: 'trump',
      move: 2,
      range: 1,
      power: 5,
      maxComposure: 16,
      placeholder: { initials: 'DT', color: '#c8323c' },
    };
    expect(() => loadUsUnits([oneUnit])).toThrow(/missing an entry for character/);
  });
});
