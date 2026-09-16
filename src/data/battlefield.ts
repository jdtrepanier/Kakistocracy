import type { GridPosition, RoomGrid, TileKind } from '@/engine/movement';

/**
 * The one battlefield every tactical battle plays out on (GAME_PLAN §7.1). Deliberately
 * generic and reusable across every country's roster — a bordered open field with a
 * couple of obstacles for a little tactical texture, US units spawning on the left,
 * the enemy roster spawning on the right. Built rather than hand-drawn ASCII (like
 * `data/roomLayouts.ts`) since it's a plain rectangle, not a bespoke room design.
 */
export const BATTLEFIELD_WIDTH = 11;
export const BATTLEFIELD_HEIGHT = 8;

const OBSTACLES: readonly GridPosition[] = [
  { x: 5, y: 3 },
  { x: 5, y: 4 },
];

function buildBattlefield(): RoomGrid {
  const rows: TileKind[][] = [];
  for (let y = 0; y < BATTLEFIELD_HEIGHT; y++) {
    const row: TileKind[] = [];
    for (let x = 0; x < BATTLEFIELD_WIDTH; x++) {
      const border =
        x === 0 || y === 0 || x === BATTLEFIELD_WIDTH - 1 || y === BATTLEFIELD_HEIGHT - 1;
      const obstacle = OBSTACLES.some((o) => o.x === x && o.y === y);
      row.push(border || obstacle ? 'wall' : 'floor');
    }
    rows.push(row);
  }
  return rows;
}

export const BATTLEFIELD: RoomGrid = buildBattlefield();

/** Spawn column/rows for each side — the full 6-official cabinet on the left (two
 * columns of 3, since every switchable official fights, GAME_PLAN §7.1/§8), up to 6
 * enemy units on the right (the largest roster, Canada's, has exactly 6). */
export const US_SPAWN_POSITIONS: readonly GridPosition[] = [
  { x: 1, y: 2 },
  { x: 1, y: 4 },
  { x: 1, y: 6 },
  { x: 2, y: 1 },
  { x: 2, y: 3 },
  { x: 2, y: 5 },
];

export const ENEMY_SPAWN_POSITIONS: readonly GridPosition[] = [
  { x: 9, y: 1 },
  { x: 9, y: 2 },
  { x: 9, y: 3 },
  { x: 9, y: 4 },
  { x: 9, y: 5 },
  { x: 9, y: 6 },
];
