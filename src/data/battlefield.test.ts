import { describe, expect, it } from 'vitest';
import { tileAt } from '@/engine/movement';
import { SWITCHABLE_CHARACTERS } from '@/store/gameStore';
import { BATTLE_ROSTERS } from './battleRosters';
import {
  BATTLEFIELD,
  BATTLEFIELD_HEIGHT,
  BATTLEFIELD_WIDTH,
  ENEMY_SPAWN_POSITIONS,
  US_SPAWN_POSITIONS,
} from './battlefield';

describe('BATTLEFIELD', () => {
  it('is bordered entirely by walls', () => {
    for (let x = 0; x < BATTLEFIELD_WIDTH; x++) {
      expect(tileAt(BATTLEFIELD, { x, y: 0 })).toBe('wall');
      expect(tileAt(BATTLEFIELD, { x, y: BATTLEFIELD_HEIGHT - 1 })).toBe('wall');
    }
    for (let y = 0; y < BATTLEFIELD_HEIGHT; y++) {
      expect(tileAt(BATTLEFIELD, { x: 0, y })).toBe('wall');
      expect(tileAt(BATTLEFIELD, { x: BATTLEFIELD_WIDTH - 1, y })).toBe('wall');
    }
  });

  it('has every US and enemy spawn on open floor, inside the grid', () => {
    for (const pos of [...US_SPAWN_POSITIONS, ...ENEMY_SPAWN_POSITIONS]) {
      expect(tileAt(BATTLEFIELD, pos)).toBe('floor');
    }
  });

  it('gives each side unique, non-overlapping spawn positions', () => {
    const all = [...US_SPAWN_POSITIONS, ...ENEMY_SPAWN_POSITIONS];
    const keys = all.map((p) => `${p.x},${p.y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('has at least as many spawn slots as the largest roster needs', () => {
    // Checked against the real current data, not a hardcoded number — real bug found on
    // a polish pass: `store/gameStore.ts`'s `selectBattleCountry` indexes
    // `US_SPAWN_POSITIONS[i]`/`ENEMY_SPAWN_POSITIONS[i]` with an unchecked `as
    // GridPosition` cast (past `noUncheckedIndexedAccess`), so a roster that ever grew
    // past its side's spawn count would silently produce `undefined` there instead of a
    // caught error — it would only surface later, confusingly, wherever that unit's
    // position is first read. This test is what makes that impossible: it fails loudly,
    // at test time, the moment either side's spawn capacity stops covering its roster,
    // rather than leaving the invariant as an unenforced comment (which is what let a
    // stale "7" linger here before — Canada's own roster already grew once this
    // session, from 6 to 7, when Jagmeet Singh joined it).
    expect(US_SPAWN_POSITIONS.length).toBeGreaterThanOrEqual(SWITCHABLE_CHARACTERS.length);
    for (const roster of Object.values(BATTLE_ROSTERS)) {
      expect(ENEMY_SPAWN_POSITIONS.length).toBeGreaterThanOrEqual(roster.length);
    }
  });
});
