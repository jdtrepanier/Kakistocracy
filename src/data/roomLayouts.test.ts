import { describe, expect, it } from 'vitest';
import { tileAt } from '@/engine/movement';
import { facingItem, getRoomLayout, hasRoomLayout, ROOM_LAYOUTS } from './roomLayouts';

describe('ROOM_LAYOUTS', () => {
  it('has a rectangular grid for every room', () => {
    for (const room of ROOM_LAYOUTS) {
      const width = room.grid[0]?.length ?? 0;
      expect(width).toBeGreaterThan(0);
      for (const row of room.grid) expect(row.length).toBe(width);
    }
  });

  it('places every object and door tile where the layout says, and the object blocks movement', () => {
    for (const room of ROOM_LAYOUTS) {
      expect(tileAt(room.grid, room.objectAt)).toBe('object');
      for (const door of room.doors) expect(tileAt(room.grid, door.at)).toBe('door');
    }
  });

  it("places the Oval Office's item pedestal where the layout says, and it blocks movement", () => {
    const ovalOffice = getRoomLayout('ovalOffice');
    expect(ovalOffice.itemAt).toEqual({ x: 10, y: 6 });
    expect(ovalOffice.itemId).toBe('autopen');
    expect(tileAt(ovalOffice.grid, ovalOffice.itemAt!)).toBe('item');
  });

  it('has no item pedestal in rooms that were never given one', () => {
    const treasury = getRoomLayout('treasury');
    expect(treasury.itemAt).toBeUndefined();
    expect(treasury.itemId).toBeUndefined();
  });

  it('starts every room on a walkable tile', () => {
    for (const room of ROOM_LAYOUTS) {
      expect(['floor', 'door']).toContain(tileAt(room.grid, room.start));
    }
  });

  it("connects Oval Office and Treasury's doors both ways", () => {
    const ovalOffice = getRoomLayout('ovalOffice');
    const treasury = getRoomLayout('treasury');
    expect(ovalOffice.doors.map((d) => d.to)).toContain('treasury');
    expect(treasury.doors.map((d) => d.to)).toContain('ovalOffice');
  });

  it('connects the Oval Office hub to every spoke room both ways', () => {
    const ovalOffice = getRoomLayout('ovalOffice');
    const spokes = [
      'situationRoom',
      'federalReserve',
      'commerce',
      'roseGarden',
      'pentagon',
      'starbase',
      'nationalMall',
      'capitol',
      'marALago',
    ] as const;
    for (const spoke of spokes) {
      const room = getRoomLayout(spoke);
      expect(ovalOffice.doors.map((d) => d.to)).toContain(spoke);
      expect(room.doors.map((d) => d.to)).toContain('ovalOffice');
    }
    // Every spoke gets its own door back to the hub, plus Treasury's (covered above) —
    // together that's the whole cast of GAME_PLAN §10's `RoomId`s except `mapRoom`.
    expect(ovalOffice.doors).toHaveLength(spokes.length + 1);
  });
});

describe('hasRoomLayout', () => {
  it('is true for every room except the World Map menu', () => {
    const ROOM_IDS = [
      'ovalOffice',
      'situationRoom',
      'treasury',
      'federalReserve',
      'commerce',
      'pentagon',
      'mapRoom',
      'starbase',
      'nationalMall',
      'roseGarden',
      'capitol',
      'marALago',
    ] as const;
    for (const id of ROOM_IDS) {
      expect(hasRoomLayout(id)).toBe(id !== 'mapRoom');
    }
  });
});

describe('getRoomLayout', () => {
  it('throws for a room with no layout yet', () => {
    expect(() => getRoomLayout('mapRoom')).toThrow();
  });
});

describe('facingItem', () => {
  it("returns the item id when standing next to the Oval Office's pedestal, facing it", () => {
    // The pedestal sits at (10, 6) — standing one tile to its left, facing right, faces it.
    expect(facingItem('ovalOffice', { x: 9, y: 6 }, 'right')).toBe('autopen');
  });

  it('returns undefined when facing away from the pedestal', () => {
    expect(facingItem('ovalOffice', { x: 9, y: 6 }, 'left')).toBeUndefined();
  });

  it('returns undefined in a room with no item pedestal at all', () => {
    expect(facingItem('treasury', { x: 1, y: 5 }, 'right')).toBeUndefined();
  });

  it('returns undefined when nowhere near the pedestal', () => {
    expect(facingItem('ovalOffice', { x: 2, y: 5 }, 'right')).toBeUndefined();
  });
});
