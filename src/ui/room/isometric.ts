import type { GridPosition, RoomGrid } from '@/engine/movement';

/**
 * Pure projection math for the isometric room camera (GAME_PLAN §11, the pre-Phase-4
 * pivot from a flat top-down grid to a 2:1 dimetric camera, closer to *The Sims*). This
 * file only turns a logical `{x, y}` grid position into on-screen numbers — no React,
 * no DOM. `RoomView.tsx` is the only place these numbers become pixels, so retuning the
 * projection (or swapping in a real PixiJS isometric renderer later) never touches
 * `engine/movement.ts` or `data/roomLayouts.ts`, which still just describe a plain grid.
 */

/** Footprint of one floor tile's diamond, in internal stage pixels (see ui/constants.ts
 * for the 480×270 stage). A 2:1 ratio is the classic "dimetric" pixel-art isometric look. */
export const ISO_TILE_WIDTH = 32;
export const ISO_TILE_HEIGHT = 16;

/** How tall a wall block or object block stands above its floor tile. */
export const ISO_WALL_HEIGHT = 22;
export const ISO_OBJECT_HEIGHT = 14;

/** How long the player token's `left`/`top` CSS glide takes to reach a new tile
 * (`.room-player` in `styles/room.css` — kept in sync with that value by hand, since
 * CSS can't reference a JS constant). `RoomView.tsx`'s `usePlayerDepth` uses the same
 * duration so the token's paint order never gets ahead of where it's actually glided
 * to. */
export const ROOM_MOVE_TRANSITION_MS = 120;

export interface IsoPoint {
  readonly x: number;
  readonly y: number;
}

/** Projects a grid cell to the center of its diamond, in an unbounded coordinate space
 * (can be negative — see `isoGridBounds` for turning this into on-screen coordinates). */
export function projectIso(pos: GridPosition): IsoPoint {
  return {
    x: (pos.x - pos.y) * (ISO_TILE_WIDTH / 2),
    y: (pos.x + pos.y) * (ISO_TILE_HEIGHT / 2),
  };
}

export interface IsoBounds {
  /** Total projected size of the grid, including margin for tile width and wall height. */
  readonly width: number;
  readonly height: number;
  /** Add these to a projected point to land inside `[0, width] x [0, height]`. */
  readonly offsetX: number;
  readonly offsetY: number;
}

/** The bounding box of every cell in `grid` once projected, plus enough margin for one
 * tile's diamond and the tallest block so nothing clips at the edges of the container. */
export function isoGridBounds(grid: RoomGrid): IsoBounds {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (rows === 0 || cols === 0) {
    return {
      width: ISO_TILE_WIDTH,
      height: ISO_TILE_HEIGHT + ISO_WALL_HEIGHT,
      offsetX: 0,
      offsetY: 0,
    };
  }

  const corners: GridPosition[] = [
    { x: 0, y: 0 },
    { x: cols - 1, y: 0 },
    { x: 0, y: rows - 1 },
    { x: cols - 1, y: rows - 1 },
  ];
  const points = corners.map(projectIso);
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Diamonds extend a symmetric half-tile from their projected center in every
  // direction except downward, where a wall/object block's extruded depth adds extra
  // room below — so only the top margin is a plain half-tile; see `height` below.
  const offsetX = ISO_TILE_WIDTH / 2 - minX;
  const offsetY = ISO_TILE_HEIGHT / 2 - minY;

  return {
    width: maxX - minX + ISO_TILE_WIDTH,
    height: maxY - minY + ISO_TILE_HEIGHT + ISO_WALL_HEIGHT,
    offsetX,
    offsetY,
  };
}

/** Projects `pos` into the same coordinate space as `bounds` — ready to use directly as
 * a CSS `left`/`top` anchor within a container sized `bounds.width x bounds.height`. */
export function projectIsoWithin(pos: GridPosition, bounds: IsoBounds): IsoPoint {
  const p = projectIso(pos);
  return { x: p.x + bounds.offsetX, y: p.y + bounds.offsetY };
}

/** Painter's-algorithm draw order: cells further down-and-right on the grid (bigger
 * `x + y`) sit closer to the camera, so they must be drawn later (on top). */
export function isoDepth(pos: GridPosition): number {
  return pos.x + pos.y;
}

export interface CubeClipPaths {
  readonly top: string;
  readonly left: string;
  readonly right: string;
}

/** `clip-path: polygon(...)` strings for the three visible faces of an isometric block
 * of footprint `width x height` (the diamond) standing `depth` px tall. Precomputed once
 * per distinct size (walls vs. objects) rather than per tile — see `CUBE_FACES_WALL`. */
export function buildCubeFaces(width: number, height: number, depth: number): CubeClipPaths {
  const halfW = width / 2;
  const halfH = height / 2;
  return {
    top: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
    left: `polygon(0px 0px, ${halfW}px ${halfH}px, ${halfW}px ${halfH + depth}px, 0px ${depth}px)`,
    right: `polygon(0px ${halfH}px, ${halfW}px 0px, ${halfW}px ${depth}px, 0px ${halfH + depth}px)`,
  };
}

export const CUBE_FACES_WALL = buildCubeFaces(ISO_TILE_WIDTH, ISO_TILE_HEIGHT, ISO_WALL_HEIGHT);
export const CUBE_FACES_OBJECT = buildCubeFaces(ISO_TILE_WIDTH, ISO_TILE_HEIGHT, ISO_OBJECT_HEIGHT);
