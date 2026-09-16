/**
 * Pure grid movement and collision for the Phase 2 "room slice" (GAME_PLAN §17). Plain
 * data in, position out — no rendering here, so swapping the CSS/DOM placeholder for a
 * real PixiJS/Tiled renderer later never touches this file.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface GridPosition {
  readonly x: number;
  readonly y: number;
}

/** 'object' and 'door' are both non-floor: an object blocks movement (you face it from
 * next to it), a door is walkable and triggers a room change when stepped onto. */
export type TileKind = 'floor' | 'wall' | 'object' | 'door';

export type RoomGrid = readonly (readonly TileKind[])[];

export const DIRECTION_DELTA: Readonly<Record<Direction, GridPosition>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** The tile at `pos`, or `undefined` if it's outside the grid. */
export function tileAt(grid: RoomGrid, pos: GridPosition): TileKind | undefined {
  return grid[pos.y]?.[pos.x];
}

/** Floor and doors can be walked onto; walls and objects block movement. */
export function isWalkable(grid: RoomGrid, pos: GridPosition): boolean {
  const tile = tileAt(grid, pos);
  return tile === 'floor' || tile === 'door';
}

/** The position one tile away from `pos` in `dir`, ignoring collision. */
export function step(pos: GridPosition, dir: Direction): GridPosition {
  const delta = DIRECTION_DELTA[dir];
  return { x: pos.x + delta.x, y: pos.y + delta.y };
}

/** New position after trying to move one tile in `dir`; unchanged if that tile blocks. */
export function moveWithin(grid: RoomGrid, pos: GridPosition, dir: Direction): GridPosition {
  const next = step(pos, dir);
  return isWalkable(grid, next) ? next : pos;
}
