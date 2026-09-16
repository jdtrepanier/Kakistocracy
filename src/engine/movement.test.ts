import { describe, expect, it } from 'vitest';
import { DIRECTION_DELTA, isWalkable, moveWithin, step, tileAt, type RoomGrid } from './movement';

// A small 3×3 room: a wall border, one object in the middle-right, one door in the
// middle-left. Row 0 is the top.
const GRID: RoomGrid = [
  ['wall', 'wall', 'wall'],
  ['door', 'floor', 'object'],
  ['wall', 'wall', 'wall'],
];

describe('tileAt', () => {
  it('returns the tile at a position', () => {
    expect(tileAt(GRID, { x: 1, y: 1 })).toBe('floor');
    expect(tileAt(GRID, { x: 0, y: 1 })).toBe('door');
    expect(tileAt(GRID, { x: 2, y: 1 })).toBe('object');
  });

  it('returns undefined outside the grid', () => {
    expect(tileAt(GRID, { x: -1, y: 1 })).toBeUndefined();
    expect(tileAt(GRID, { x: 1, y: -1 })).toBeUndefined();
    expect(tileAt(GRID, { x: 1, y: 99 })).toBeUndefined();
  });
});

describe('isWalkable', () => {
  it('allows floor and doors', () => {
    expect(isWalkable(GRID, { x: 1, y: 1 })).toBe(true);
    expect(isWalkable(GRID, { x: 0, y: 1 })).toBe(true);
  });

  it('blocks walls, objects, and anything off the grid', () => {
    expect(isWalkable(GRID, { x: 0, y: 0 })).toBe(false);
    expect(isWalkable(GRID, { x: 2, y: 1 })).toBe(false);
    expect(isWalkable(GRID, { x: -1, y: 1 })).toBe(false);
  });
});

describe('step', () => {
  it('moves one tile in each direction', () => {
    expect(step({ x: 1, y: 1 }, 'up')).toEqual({ x: 1, y: 0 });
    expect(step({ x: 1, y: 1 }, 'down')).toEqual({ x: 1, y: 2 });
    expect(step({ x: 1, y: 1 }, 'left')).toEqual({ x: 0, y: 1 });
    expect(step({ x: 1, y: 1 }, 'right')).toEqual({ x: 2, y: 1 });
  });

  it('matches DIRECTION_DELTA', () => {
    for (const dir of Object.keys(DIRECTION_DELTA) as (keyof typeof DIRECTION_DELTA)[]) {
      const delta = DIRECTION_DELTA[dir];
      expect(step({ x: 5, y: 5 }, dir)).toEqual({ x: 5 + delta.x, y: 5 + delta.y });
    }
  });
});

describe('moveWithin', () => {
  it('moves onto floor', () => {
    // From the door, moving right reaches the floor tile.
    expect(moveWithin(GRID, { x: 0, y: 1 }, 'right')).toEqual({ x: 1, y: 1 });
  });

  it('moves onto a door', () => {
    expect(moveWithin(GRID, { x: 1, y: 1 }, 'left')).toEqual({ x: 0, y: 1 });
  });

  it('is blocked by a wall and stays put', () => {
    expect(moveWithin(GRID, { x: 1, y: 1 }, 'up')).toEqual({ x: 1, y: 1 });
  });

  it('is blocked by an object and stays put', () => {
    expect(moveWithin(GRID, { x: 1, y: 1 }, 'right')).toEqual({ x: 1, y: 1 });
  });

  it('is blocked at the edge of the grid', () => {
    expect(moveWithin(GRID, { x: 0, y: 1 }, 'left')).toEqual({ x: 0, y: 1 });
  });
});
