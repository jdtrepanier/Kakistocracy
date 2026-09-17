import { describe, expect, it } from 'vitest';
import { COUNTRIES } from './countries';
import { BATTLE_ROSTERS, US_BATTLE_UNITS, getBattleRoster } from './battleRosters';

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

  it("doesn't exceed the battlefield's enemy spawn capacity (7 slots)", () => {
    for (const roster of Object.values(BATTLE_ROSTERS)) {
      expect(roster.length).toBeLessThanOrEqual(7);
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
    const mackinawGuy = canada.find((u) => u.id === 'canada-mackinaw-guy');

    expect(carney?.magic?.kind).toBe('charm');
    expect(trudeau?.healsFromWomen).toBe(true);
    expect(miller?.backstabChance).toBe(0.5);
    expect(leblanc?.dodgeChance).toBe(0.5);

    // High HP (Carney) < Really high HP (the wildcard) < neither above the other's
    // baseline-plus-quirk siblings, and Low HP (Trudeau) below the roster's baseline.
    expect(carney?.maxComposure).toBeGreaterThan(miller?.maxComposure ?? 0);
    expect(mackinawGuy?.maxComposure).toBeGreaterThan(carney?.maxComposure ?? 0);
    expect(trudeau?.maxComposure).toBeLessThan(miller?.maxComposure ?? 0);
  });
});

describe('getBattleRoster', () => {
  it('returns the matching roster', () => {
    expect(getBattleRoster('canada')).toBe(BATTLE_ROSTERS.canada);
    expect(getBattleRoster('canada')).toHaveLength(7);
  });
});
