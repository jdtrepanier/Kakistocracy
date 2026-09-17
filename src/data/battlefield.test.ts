import { describe, expect, it } from 'vitest';
import { tileAt } from '@/engine/movement';
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
    // Canada's roster (data/battleRosters.ts) has 7 units — the largest, since Jagmeet
    // Singh joined it. All 6 US officials fight together too (gameStore's
    // SWITCHABLE_CHARACTERS), so the US side still only needs 6 slots.
    expect(US_SPAWN_POSITIONS.length).toBeGreaterThanOrEqual(6);
    expect(ENEMY_SPAWN_POSITIONS.length).toBeGreaterThanOrEqual(7);
  });
});
