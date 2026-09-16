import { describe, expect, it } from 'vitest';
import type { RoomGrid } from '@/engine/movement';
import {
  ISO_TILE_HEIGHT,
  ISO_TILE_WIDTH,
  ISO_WALL_HEIGHT,
  buildCubeFaces,
  isoDepth,
  isoGridBounds,
  projectIso,
  projectIsoWithin,
} from './isometric';

const GRID_3X2: RoomGrid = [
  ['floor', 'floor', 'floor'],
  ['floor', 'floor', 'floor'],
];

describe('projectIso', () => {
  it('projects the origin to the origin', () => {
    expect(projectIso({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('moves half a tile width/height per axis step', () => {
    expect(projectIso({ x: 1, y: 0 })).toEqual({
      x: ISO_TILE_WIDTH / 2,
      y: ISO_TILE_HEIGHT / 2,
    });
    expect(projectIso({ x: 0, y: 1 })).toEqual({
      x: -ISO_TILE_WIDTH / 2,
      y: ISO_TILE_HEIGHT / 2,
    });
  });

  it('cancels x and y offsets diagonally back to a straight vertical line', () => {
    expect(projectIso({ x: 1, y: 1 })).toEqual({ x: 0, y: ISO_TILE_HEIGHT });
  });
});

describe('isoGridBounds', () => {
  it('gives every projected corner enough margin to stay inside the bounds', () => {
    const bounds = isoGridBounds(GRID_3X2);
    const corners = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 2, y: 1 },
    ];
    for (const corner of corners) {
      const p = projectIsoWithin(corner, bounds);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(bounds.width);
      expect(p.y).toBeLessThanOrEqual(bounds.height);
    }
  });

  it('reserves extra room below for a wall block standing on the deepest tile', () => {
    const bounds = isoGridBounds(GRID_3X2);
    const deepest = projectIsoWithin({ x: 2, y: 1 }, bounds);
    // The bottom of a wall block at the deepest tile is at its center + half a tile +
    // the wall height; that must still land inside the container.
    expect(deepest.y + ISO_TILE_HEIGHT / 2 + ISO_WALL_HEIGHT).toBeLessThanOrEqual(bounds.height);
  });

  it('falls back to a minimal box for an empty grid', () => {
    expect(isoGridBounds([])).toEqual({
      width: ISO_TILE_WIDTH,
      height: ISO_TILE_HEIGHT + ISO_WALL_HEIGHT,
      offsetX: 0,
      offsetY: 0,
    });
  });
});

describe('isoDepth', () => {
  it('grows with x + y, so tiles further down-right draw on top', () => {
    expect(isoDepth({ x: 0, y: 0 })).toBe(0);
    expect(isoDepth({ x: 2, y: 3 })).toBeGreaterThan(isoDepth({ x: 1, y: 1 }));
  });
});

describe('buildCubeFaces', () => {
  it('gives the top face a fixed diamond clip-path independent of depth', () => {
    const a = buildCubeFaces(32, 16, 10);
    const b = buildCubeFaces(32, 16, 40);
    expect(a.top).toBe(b.top);
    expect(a.top).toBe('polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)');
  });

  it('grows the left/right face polygons with depth', () => {
    const shallow = buildCubeFaces(32, 16, 10);
    const deep = buildCubeFaces(32, 16, 40);
    expect(shallow.left).not.toBe(deep.left);
    expect(shallow.right).not.toBe(deep.right);
  });
});
