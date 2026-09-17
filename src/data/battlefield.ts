import type { GridPosition, RoomGrid, TileKind } from '@/engine/movement';

/**
 * The one battlefield every tactical battle plays out on (GAME_PLAN §7.1). Deliberately
 * generic and reusable across every country's roster — a bordered open field with a
 * couple of obstacles for a little tactical texture, US units spawning on the left,
 * the enemy roster spawning on the right. Built rather than hand-drawn ASCII (like
 * `data/roomLayouts.ts`) since it's a plain rectangle, not a bespoke room design.
 *
 * Grew from 11×8 to 20×14 (user feedback: "make the battle much bigger and we could
 * scroll the map like in Shining Force") — big enough that `ui/battle/BattleView.tsx`'s
 * projected grid no longer fits the battle viewport at once on either axis, so the new
 * scrolling/auto-follow camera (`ui/battle/battleCamera.ts`) actually has something to
 * scroll. The obstacle cluster grew to match (a small plus-shape near the middle, plus
 * two lone blockers) rather than just stretching the same two-tile pair across a much
 * bigger open field.
 */
export const BATTLEFIELD_WIDTH = 20;
export const BATTLEFIELD_HEIGHT = 14;

const OBSTACLES: readonly GridPosition[] = [
  { x: 9, y: 5 },
  { x: 9, y: 6 },
  { x: 9, y: 7 },
  { x: 10, y: 6 },
  { x: 13, y: 3 },
  { x: 13, y: 10 },
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
 * columns of 3, since every switchable official fights, GAME_PLAN §7.1/§8), up to 7
 * enemy units on the right (the largest roster, Canada's, has exactly 7 since Jagmeet
 * Singh joined it — `data/battleRosters.ts`). Re-centered vertically for the 20×14
 * field (interior rows 1–12, so centered around row 6–7) rather than reusing the old
 * 11×8 field's coordinates verbatim; the 7th enemy slot sits one column back (x:16)
 * rather than extending the x:17 column further, same reasoning as the old field's 7th
 * slot — clear of the `OBSTACLES` cluster and every other spawn tile. */
export const US_SPAWN_POSITIONS: readonly GridPosition[] = [
  { x: 2, y: 5 },
  { x: 2, y: 7 },
  { x: 2, y: 9 },
  { x: 3, y: 4 },
  { x: 3, y: 6 },
  { x: 3, y: 8 },
];

export const ENEMY_SPAWN_POSITIONS: readonly GridPosition[] = [
  { x: 17, y: 4 },
  { x: 17, y: 5 },
  { x: 17, y: 6 },
  { x: 17, y: 7 },
  { x: 17, y: 8 },
  { x: 17, y: 9 },
  { x: 16, y: 6 },
];
