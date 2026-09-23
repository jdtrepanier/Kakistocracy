import type { RoomId } from '@/engine/actions';
import {
  step,
  type Direction,
  type GridPosition,
  type RoomGrid,
  type TileKind,
} from '@/engine/movement';
import type { ItemId } from '@/engine/types';

/**
 * Room slice (GAME_PLAN §17): walkable CSS/DOM tile grids (see the "Room rendering"
 * decision in §15 — real PixiJS/Tiled maps come later, this is plain data so swapping
 * the renderer won't touch it). One action-bound object per room for now ("actions
 * bound to objects"). Phase 2 shipped Oval Office + Treasury; Phase 4 added Situation
 * Room, Federal Reserve and Commerce; Phase 5 adds Rose Garden, Pentagon, Starbase and
 * National Mall as four more hub spokes off the Oval Office, each home to the
 * action(s) already tagged with that room in `data/actions.ts` (Rally/Press
 * Conference/Flip/Be Best; Rename a Department; Fire a Rocket; Military Parade) that
 * were previously reachable only through the toolbar's full-catalog escape hatch. That
 * makes every `RoomId` walkable except `mapRoom`, which GAME_PLAN §10 deliberately
 * keeps as a full-screen status-board menu (`MapScreen.tsx`) rather than a room — see
 * `hasRoomLayout` below.
 *
 * Re-entering a room always lands the player on its own `start` tile, regardless of
 * which door was used to get there — same simplification Phase 2 shipped with (one
 * shared arrival point per room, not per door-pair). With the hub now having eight
 * doors instead of one, walking back into the Oval Office from any spoke always
 * arrives at the same spot near the Treasury door; a per-door arrival point is a
 * nice-to-have for a later pass, not required for the vertical slice.
 */
export interface RoomLayout {
  readonly id: RoomId;
  readonly grid: RoomGrid;
  /** Where the player lands on a fresh game, or when no door leads here yet. */
  readonly start: GridPosition;
  /** The single action-bound object tile in this room (GAME_PLAN §11 "DECREE"). */
  readonly objectAt: GridPosition;
  /** A grabbable item's pedestal (real user feedback: "you can also put an autopen item
   * somewhere else that you can grab" — `data/items.ts`'s own doc comment has the full
   * story). Optional: most rooms have none. Always set together with `itemId`. */
  readonly itemAt?: GridPosition;
  readonly itemId?: ItemId;
  readonly doors: readonly { readonly at: GridPosition; readonly to: RoomId }[];
}

const TILE_LEGEND: Readonly<Record<string, TileKind>> = {
  '#': 'wall',
  '.': 'floor',
  O: 'object',
  I: 'item',
  D: 'door',
};

/** Turns a row of legend characters into a row of tiles. Every row must be the same length. */
function parseGrid(rows: readonly string[]): RoomGrid {
  return rows.map((row) =>
    row.split('').map((char) => {
      const tile = TILE_LEGEND[char];
      if (!tile) throw new Error(`Unknown room-layout tile: "${char}"`);
      return tile;
    }),
  );
}

const OVAL_OFFICE_ROWS = [
  '######D########D#####D###D####',
  '#............................#',
  'D............................#',
  '#............................#',
  '#..............O.............#',
  'D............................D',
  '#.........I..................#',
  '#............................D',
  '#............................#',
  '#............................#',
  '###############D######D#######',
] as const;

const TREASURY_ROWS = [
  '##############################',
  '#............................#',
  '#............................#',
  '#............................#',
  '#............................#',
  'D............................#',
  '#............................#',
  '#...................O........#',
  '#............................#',
  '#............................#',
  '##############################',
] as const;

const SITUATION_ROOM_ROWS = [
  '###########D############',
  '#......................#',
  '#......................#',
  '#......................#',
  '#............O.........#',
  '#......................#',
  '#......................#',
  '#......................#',
  '########################',
] as const;

const FEDERAL_RESERVE_ROWS = [
  '########################',
  '#......................#',
  '#......................#',
  '#..........O...........#',
  '#......................D',
  '#......................#',
  '#......................#',
  '#......................#',
  '########################',
] as const;

const COMMERCE_ROWS = [
  '########################',
  '#......................#',
  '#......................#',
  '#......................#',
  '#............O.........#',
  '#......................#',
  '#......................#',
  '#......................#',
  '###########D############',
] as const;

const ROSE_GARDEN_ROWS = [
  '######################',
  '#....................#',
  '#...........O........#',
  '#....................#',
  '#....................#',
  '#....................#',
  '##########D###########',
] as const;

const PENTAGON_ROWS = [
  '########################',
  '#......................#',
  '#......................#',
  '#...........O..........#',
  '#......................#',
  '#......................#',
  '#......................#',
  '############D###########',
] as const;

const STARBASE_ROWS = [
  '######################',
  '#....................#',
  '#....................#',
  '#....................#',
  '#.........O..........D',
  '#....................#',
  '#....................#',
  '#....................#',
  '######################',
] as const;

const NATIONAL_MALL_ROWS = [
  '#############D############',
  '#........................#',
  '#........................#',
  '#........................#',
  '#............O...........#',
  '#........................#',
  '#........................#',
  '##########################',
] as const;

const CAPITOL_ROWS = [
  '########################',
  '#......................#',
  '#......................#',
  '#...........O..........#',
  '#......................#',
  '#......................#',
  '#......................#',
  '############D###########',
] as const;

const MAR_A_LAGO_ROWS = [
  '######################',
  '#....................#',
  '#....................#',
  '#....................#',
  'D..........O.........#',
  '#....................#',
  '#....................#',
  '#....................#',
  '######################',
] as const;

export const ROOM_LAYOUTS: readonly RoomLayout[] = [
  {
    id: 'ovalOffice',
    grid: parseGrid(OVAL_OFFICE_ROWS),
    start: { x: 2, y: 5 },
    objectAt: { x: 15, y: 4 },
    itemAt: { x: 10, y: 6 },
    itemId: 'autopen',
    doors: [
      { at: { x: 29, y: 5 }, to: 'treasury' },
      { at: { x: 0, y: 5 }, to: 'federalReserve' },
      { at: { x: 15, y: 0 }, to: 'commerce' },
      { at: { x: 15, y: 10 }, to: 'situationRoom' },
      { at: { x: 6, y: 0 }, to: 'roseGarden' },
      { at: { x: 21, y: 0 }, to: 'pentagon' },
      { at: { x: 0, y: 2 }, to: 'starbase' },
      { at: { x: 22, y: 10 }, to: 'nationalMall' },
      { at: { x: 25, y: 0 }, to: 'capitol' },
      { at: { x: 29, y: 7 }, to: 'marALago' },
    ],
  },
  {
    id: 'treasury',
    grid: parseGrid(TREASURY_ROWS),
    start: { x: 1, y: 5 },
    objectAt: { x: 20, y: 7 },
    doors: [{ at: { x: 0, y: 5 }, to: 'ovalOffice' }],
  },
  {
    id: 'situationRoom',
    grid: parseGrid(SITUATION_ROOM_ROWS),
    start: { x: 11, y: 1 },
    objectAt: { x: 13, y: 4 },
    doors: [{ at: { x: 11, y: 0 }, to: 'ovalOffice' }],
  },
  {
    id: 'federalReserve',
    grid: parseGrid(FEDERAL_RESERVE_ROWS),
    start: { x: 22, y: 4 },
    objectAt: { x: 11, y: 3 },
    doors: [{ at: { x: 23, y: 4 }, to: 'ovalOffice' }],
  },
  {
    id: 'commerce',
    grid: parseGrid(COMMERCE_ROWS),
    start: { x: 11, y: 7 },
    objectAt: { x: 13, y: 4 },
    doors: [{ at: { x: 11, y: 8 }, to: 'ovalOffice' }],
  },
  {
    id: 'roseGarden',
    grid: parseGrid(ROSE_GARDEN_ROWS),
    start: { x: 10, y: 5 },
    objectAt: { x: 12, y: 2 },
    doors: [{ at: { x: 10, y: 6 }, to: 'ovalOffice' }],
  },
  {
    id: 'pentagon',
    grid: parseGrid(PENTAGON_ROWS),
    start: { x: 12, y: 6 },
    objectAt: { x: 12, y: 3 },
    doors: [{ at: { x: 12, y: 7 }, to: 'ovalOffice' }],
  },
  {
    id: 'starbase',
    grid: parseGrid(STARBASE_ROWS),
    start: { x: 20, y: 4 },
    objectAt: { x: 10, y: 4 },
    doors: [{ at: { x: 21, y: 4 }, to: 'ovalOffice' }],
  },
  {
    id: 'nationalMall',
    grid: parseGrid(NATIONAL_MALL_ROWS),
    start: { x: 13, y: 1 },
    objectAt: { x: 13, y: 4 },
    doors: [{ at: { x: 13, y: 0 }, to: 'ovalOffice' }],
  },
  {
    id: 'capitol',
    grid: parseGrid(CAPITOL_ROWS),
    start: { x: 12, y: 6 },
    objectAt: { x: 12, y: 3 },
    doors: [{ at: { x: 12, y: 7 }, to: 'ovalOffice' }],
  },
  {
    id: 'marALago',
    grid: parseGrid(MAR_A_LAGO_ROWS),
    start: { x: 1, y: 4 },
    objectAt: { x: 11, y: 4 },
    doors: [{ at: { x: 0, y: 4 }, to: 'ovalOffice' }],
  },
];

export function getRoomLayout(id: RoomId): RoomLayout {
  const layout = ROOM_LAYOUTS.find((r) => r.id === id);
  if (!layout) throw new Error(`No Phase 2 layout yet for room: ${id}`);
  return layout;
}

/** Whether a walkable layout exists for `id` yet — every `RoomId` except `mapRoom`,
 * which is deliberately a menu, not a room (see the file doc comment above). */
export function hasRoomLayout(id: RoomId): boolean {
  return ROOM_LAYOUTS.some((r) => r.id === id);
}

/** The `ItemId` the player would grab by pressing ITEM right now, or `undefined` if
 * they're not facing a room's item pedestal at all — mirrors the DECREE object's own
 * "face it, then act" convention (`RoomView.tsx`'s `facingObject`), just for `itemAt`/
 * `itemId` instead of `objectAt`. Doesn't check whether the item's already been
 * collected — `store/gameStore.ts`'s `grabItem` is what's idempotent, this is just
 * "what's on the tile in front of you." */
export function facingItem(
  roomId: RoomId,
  pos: GridPosition,
  facing: Direction,
): ItemId | undefined {
  const layout = getRoomLayout(roomId);
  if (!layout.itemAt || !layout.itemId) return undefined;
  const target = step(pos, facing);
  return target.x === layout.itemAt.x && target.y === layout.itemAt.y ? layout.itemId : undefined;
}
