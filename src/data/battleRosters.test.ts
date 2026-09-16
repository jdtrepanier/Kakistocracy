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

  it("doesn't exceed the battlefield's enemy spawn capacity (6 slots)", () => {
    for (const roster of Object.values(BATTLE_ROSTERS)) {
      expect(roster.length).toBeLessThanOrEqual(6);
    }
  });
});

describe('getBattleRoster', () => {
  it('returns the matching roster', () => {
    expect(getBattleRoster('canada')).toBe(BATTLE_ROSTERS.canada);
    expect(getBattleRoster('canada')).toHaveLength(6);
  });
});
