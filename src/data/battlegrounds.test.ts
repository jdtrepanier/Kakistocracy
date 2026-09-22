import { describe, expect, it } from 'vitest';
import { BATTLE_ROSTERS } from '@/data/battleRosters';
import { tileAt } from '@/engine/movement';
import type { CountryId } from '@/engine/types';
import { SWITCHABLE_CHARACTERS } from '@/store/gameStore';
import {
  BATTLEFIELD,
  BATTLEFIELD_HEIGHT,
  BATTLEFIELD_WIDTH,
  ENEMY_SPAWN_POSITIONS,
  US_SPAWN_POSITIONS,
} from './battlefield';
import {
  CANADA_BATTLEGROUND,
  getBattleground,
  gridFromTerrain,
  loadBattleground,
  parseGrid,
  parsePositions,
  parseProps,
  TERRAIN_KINDS,
  TILE_KINDS,
  WALKABLE_TERRAIN,
} from './battlegrounds';

const ALL_COUNTRIES: readonly CountryId[] = [
  'canada',
  'greenland',
  'panama',
  'mexico',
  'iran',
  'venezuela',
  'russia',
];

describe('getBattleground', () => {
  it('returns the custom layout for Canada', () => {
    expect(getBattleground('canada')).toBe(CANADA_BATTLEGROUND);
  });

  it('gives every country its own layout, with every spawn on a walkable cell and enough spawns for its roster', () => {
    // Every country now has its own hand-editable data/battlegrounds/<id>.json (Canada's
    // was first; the other six followed when the user asked for a map editor "for
    // countries" and pointed out only Canada had a file) — this loops generically rather
    // than special-casing Canada, so it also covers the six countries that started as a
    // lossless dump of the old shared BATTLEFIELD/spawn arrays. Derives each country's
    // width/height from its own grid rather than the old fixed BATTLEFIELD_WIDTH/HEIGHT
    // constants — nothing requires every country to share one size anymore (user request:
    // "I also want to edit the GRID_W and GRID_H"), even though all seven still happen to
    // be 20×14 today.
    for (const country of ALL_COUNTRIES) {
      const { grid, usSpawns, enemySpawns } = getBattleground(country);
      for (const pos of [...usSpawns, ...enemySpawns]) {
        expect(tileAt(grid, pos)).toBe('floor');
      }
      expect(usSpawns.length).toBeGreaterThanOrEqual(SWITCHABLE_CHARACTERS.length);
      expect(enemySpawns.length).toBeGreaterThanOrEqual(BATTLE_ROSTERS[country].length);
    }
  });

  it('walls the outer border for every country with no terrain grid (hand-typed grid is the only walkability source there)', () => {
    // Canada is excluded here on purpose: once a country has a `terrain` grid at all,
    // `grid` is *derived* from it (`gridFromTerrain`, user request: "The terrain map
    // should be based on the selected background tile"), not independently hand-typed —
    // so whether its border reads as a wall is now whatever terrain the border cells were
    // actually painted (today: grass, so it's walkable — the player's own map, not a bug
    // this loader enforces against). The six terrain-less countries still get this
    // structural guarantee for free, since they're unaffected by that change.
    for (const country of ALL_COUNTRIES) {
      if (country === 'canada') continue;
      const { grid } = getBattleground(country);
      const width = grid[0]!.length;
      const height = grid.length;
      for (let x = 0; x < width; x++) {
        expect(tileAt(grid, { x, y: 0 })).toBe('wall');
        expect(tileAt(grid, { x, y: height - 1 })).toBe('wall');
      }
      for (let y = 0; y < height; y++) {
        expect(tileAt(grid, { x: 0, y })).toBe('wall');
        expect(tileAt(grid, { x: width - 1, y })).toBe('wall');
      }
    }
  });

  it('gives the six non-Canada countries a lossless, but independent, copy of the old shared grid/spawns', () => {
    // Same "same values today, different array" decoupling Canada's own spawns went
    // through in the previous round — each of these six started life as a straight dump
    // of data/battlefield.ts's one shared BATTLEFIELD/US_SPAWN_POSITIONS/
    // ENEMY_SPAWN_POSITIONS, so editing one country's file can never silently move
    // another's, or the shared arrays those tests still exercise directly.
    for (const country of ALL_COUNTRIES) {
      if (country === 'canada') continue;
      const { grid, terrain, props, usSpawns, enemySpawns } = getBattleground(country);
      expect(grid).toEqual(BATTLEFIELD);
      expect(grid).not.toBe(BATTLEFIELD);
      expect(usSpawns).toEqual(US_SPAWN_POSITIONS);
      expect(usSpawns).not.toBe(US_SPAWN_POSITIONS);
      expect(enemySpawns).toEqual(ENEMY_SPAWN_POSITIONS);
      expect(enemySpawns).not.toBe(ENEMY_SPAWN_POSITIONS);
      expect(terrain).toBeUndefined();
      expect(props).toBeUndefined();
    }
  });
});

describe('CANADA_BATTLEGROUND', () => {
  // Canada's battleground is now the user's own hand-crafted 29×29 map, built with
  // `mapeditor/`'s isometric editor rather than the small generated layout this describe
  // block used to test (river diagonal band, a fixed 20×14 size, hardcoded engagement-band
  // coordinates) — none of that geometry is real anymore, so those tests were replaced
  // with ones that hold for *whatever* Canada's current map actually is, the same way the
  // generic `ALL_COUNTRIES` tests above do. The old geometry-specific assertions lived
  // here as regression tests for a layout that's since been fully replaced by the player;
  // see git history (or the earlier entries in `CLAUDE.md`) if that history is ever needed
  // again.
  const { grid, terrain, props, usSpawns, enemySpawns } = CANADA_BATTLEGROUND;
  const width = grid[0]!.length;
  const height = grid.length;

  it('has every US and enemy spawn on a walkable cell', () => {
    for (const pos of [...usSpawns, ...enemySpawns]) {
      expect(tileAt(grid, pos)).toBe('floor');
    }
  });

  it('has enough spawn points for every unit on each side', () => {
    // A hand-edited canada.json could accidentally drop a spawn point below what the
    // roster needs — every US battle always fields all of SWITCHABLE_CHARACTERS, and
    // Canada's roster (data/battleRosters.ts) is the largest in the game.
    expect(usSpawns.length).toBeGreaterThanOrEqual(SWITCHABLE_CHARACTERS.length);
    expect(enemySpawns.length).toBeGreaterThanOrEqual(BATTLE_ROSTERS.canada.length);
  });

  it('has a terrain grid with the same dimensions as the walkable grid', () => {
    expect(terrain).toBeDefined();
    expect(terrain).toHaveLength(height);
    for (const row of terrain ?? []) {
      expect(row).toHaveLength(width);
    }
  });

  it('has its grid fully derived from terrain — the real regression test for "the terrain map should be based on the selected background tile"', () => {
    // The actual feature request, verified end to end against the real committed file
    // (not just synthetic data — see the `loadBattleground`/`gridFromTerrain` describe
    // blocks below for that): every cell's walkability matches what `gridFromTerrain`
    // would compute from Canada's own terrain, cell for cell, not just in aggregate.
    expect(grid).toEqual(gridFromTerrain(terrain!));
  });

  it('gives each prop an image path under the shared battle-tiles atlas', () => {
    for (const prop of props ?? []) {
      expect(prop.image).toMatch(/^\/assets\/battle-tiles\/props\/[a-z0-9-]+\.png$/);
    }
  });
});

describe('gridFromTerrain', () => {
  it('maps grass, rockyGround and stonePath to floor', () => {
    expect(gridFromTerrain([['grass', 'rockyGround', 'stonePath']])).toEqual([
      ['floor', 'floor', 'floor'],
    ]);
  });

  it('maps water and cliff to wall', () => {
    expect(gridFromTerrain([['water', 'cliff']])).toEqual([['wall', 'wall']]);
  });

  it('agrees with WALKABLE_TERRAIN for every TerrainKind', () => {
    for (const kind of TERRAIN_KINDS) {
      // Indexed (not destructured) — noUncheckedIndexedAccess types `grid[0]` as possibly
      // undefined for a general readonly array, same reasoning as this file's own
      // `grid[y]?.[x]` pattern elsewhere.
      const cell = gridFromTerrain([[kind]])[0]?.[0];
      expect(cell).toBe(WALKABLE_TERRAIN.has(kind) ? 'floor' : 'wall');
    }
  });

  it('never produces object or door — only floor/wall', () => {
    for (const kind of TERRAIN_KINDS) {
      const cell = gridFromTerrain([[kind]])[0]?.[0];
      expect(['floor', 'wall']).toContain(cell);
    }
  });
});

describe('battleground JSON validation (parseGrid/parsePositions/parseProps)', () => {
  // The whole point of loading a country's layout from JSON (data/battlegrounds/*.json,
  // hand-editable per that folder's README) instead of hardcoding it in this file is that
  // a typo should throw a clear, specific error at load time — not silently render a
  // broken tile or crash somewhere unrelated later. These exercise that promise directly,
  // with synthetic bad input, rather than only relying on the real canada.json staying
  // valid (which the rest of this file's tests already cover as a side effect of passing).
  //
  // parseGrid no longer checks a grid's size against a fixed constant (user request: "I
  // also want to edit the GRID_W and GRID_H") — it derives width from the grid's own first
  // row and only requires the grid be rectangular. `validGrid` below is still 20×14 (real
  // battlegrounds still are, today), but that's incidental now, not enforced.
  const validRow = Array(BATTLEFIELD_WIDTH).fill('floor');
  const validGrid = Array(BATTLEFIELD_HEIGHT)
    .fill(null)
    .map(() => [...validRow]);

  it('parseGrid accepts a well-formed grid unchanged', () => {
    expect(parseGrid(validGrid, TILE_KINDS, 'test')).toEqual(validGrid);
  });

  it('parseGrid derives its expected size from the grid itself, not a fixed constant', () => {
    // A grid far smaller (or, in principle, larger) than the game's current 20×14
    // battlefields is accepted just fine, as long as it's rectangular.
    const smallGrid = [
      ['floor', 'floor', 'wall'],
      ['wall', 'floor', 'wall'],
    ];
    expect(parseGrid(smallGrid, TILE_KINDS, 'test')).toEqual(smallGrid);
  });

  it('parseGrid rejects an empty array (no rows)', () => {
    expect(() => parseGrid([], TILE_KINDS, 'test grid')).toThrow(/non-empty/);
  });

  it('parseGrid rejects a row with a different length than row 0', () => {
    const badGrid = validGrid.map((row, y) => (y === 3 ? row.slice(0, -1) : row));
    expect(() => parseGrid(badGrid, TILE_KINDS, 'test grid')).toThrow(/row 3/);
  });

  it('parseGrid rejects an invalid cell value and names the offending cell', () => {
    const badGrid = validGrid.map((row, y) =>
      y === 5 ? row.map((c, x) => (x === 7 ? 'lava' : c)) : row,
    );
    // validGrid is filled with 'floor' (a TILE_KIND) — must validate against TILE_KINDS,
    // like its sibling tests just above, not TERRAIN_KINDS (which 'floor' itself would
    // fail against, throwing on cell (0, 0) before ever reaching the injected bad cell).
    expect(() => parseGrid(badGrid, TILE_KINDS, 'test grid')).toThrow(/\(7, 5\)/);
  });

  it('parsePositions accepts positions inside the given width/height', () => {
    expect(
      parsePositions(
        [
          { x: 0, y: 0 },
          { x: 19, y: 13 },
        ],
        'test',
        BATTLEFIELD_WIDTH,
        BATTLEFIELD_HEIGHT,
      ),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 19, y: 13 },
    ]);
  });

  it('parsePositions rejects a position outside the given width/height', () => {
    expect(() =>
      parsePositions([{ x: 20, y: 0 }], 'test spawns', BATTLEFIELD_WIDTH, BATTLEFIELD_HEIGHT),
    ).toThrow(/test spawns\[0\]/);
  });

  it('parsePositions rejects a non-integer position', () => {
    expect(() =>
      parsePositions([{ x: 1.5, y: 0 }], 'test spawns', BATTLEFIELD_WIDTH, BATTLEFIELD_HEIGHT),
    ).toThrow();
  });

  it("parsePositions' bounds scale with whatever width/height is passed in, not a fixed constant", () => {
    expect(() => parsePositions([{ x: 3, y: 0 }], 'test spawns', 3, 3)).toThrow(/test spawns\[0\]/);
    expect(parsePositions([{ x: 2, y: 0 }], 'test spawns', 3, 3)).toEqual([{ x: 2, y: 0 }]);
  });

  it('parseProps accepts a well-formed prop list', () => {
    const props = [{ pos: { x: 1, y: 1 }, image: '/assets/battle-tiles/props/tree-round-a.png' }];
    expect(parseProps(props, 'test', BATTLEFIELD_WIDTH, BATTLEFIELD_HEIGHT)).toEqual(props);
  });

  it('parseProps rejects an entry missing "image"', () => {
    expect(() =>
      parseProps([{ pos: { x: 1, y: 1 } }], 'test props', BATTLEFIELD_WIDTH, BATTLEFIELD_HEIGHT),
    ).toThrow(/test props\[0\]/);
  });
});

describe('loadBattleground (per-file dynamic grid size)', () => {
  // Exercises the actual feature the user asked for ("I also want to edit the GRID_W and
  // GRID_H") end to end with synthetic raw JSON, since every real committed
  // battlegrounds/*.json file still happens to be 20×14 and wouldn't otherwise prove a
  // different size works.
  it('accepts a grid smaller than the old fixed 20x14 size, deriving bounds from it', () => {
    const raw = {
      grid: [
        ['wall', 'wall', 'wall', 'wall'],
        ['wall', 'floor', 'floor', 'wall'],
        ['wall', 'wall', 'wall', 'wall'],
      ],
      usSpawns: [{ x: 1, y: 1 }],
      enemySpawns: [{ x: 2, y: 1 }],
    };
    const layout = loadBattleground(raw, 'canada');
    expect(layout.grid).toEqual(raw.grid);
    expect(layout.usSpawns).toEqual(raw.usSpawns);
    expect(layout.enemySpawns).toEqual(raw.enemySpawns);
  });

  it("rejects a spawn outside that grid's own bounds, even though it would fit the old 20x14 field", () => {
    const raw = {
      grid: [
        ['wall', 'wall', 'wall', 'wall'],
        ['wall', 'floor', 'floor', 'wall'],
        ['wall', 'wall', 'wall', 'wall'],
      ],
      // (5, 1) is well inside a 20×14 field, but this grid is only 4 wide.
      usSpawns: [{ x: 5, y: 1 }],
      enemySpawns: [{ x: 2, y: 1 }],
    };
    // loadBattleground wraps the field name in literal quotes when building the label it
    // hands to parsePositions (`${label} "usSpawns"`, see battlegrounds.ts), so the thrown
    // message reads `battlegrounds/canada.json "usSpawns"[0]: ...` — the quote sits between
    // usSpawns and the index, which a bare /usSpawns\[0\]/ regex doesn't match.
    expect(() => loadBattleground(raw, 'canada')).toThrow(/"usSpawns"\[0\]/);
  });

  it('derives grid from terrain when terrain is present, overriding a conflicting hand-typed grid value', () => {
    // The actual feature (user: "The terrain map should be based on the selected
    // background tile. You can walk on grass, rocky ground and stonePath.") — a
    // deliberately conflicting raw "grid" proves terrain wins, not just that they agree
    // when someone kept them in sync by hand.
    const raw = {
      grid: [
        ['wall', 'wall'],
        ['floor', 'floor'],
      ],
      terrain: [
        ['grass', 'water'],
        ['cliff', 'stonePath'],
      ],
      usSpawns: [],
      enemySpawns: [],
    };
    const layout = loadBattleground(raw, 'canada');
    expect(layout.grid).toEqual([
      ['floor', 'wall'],
      ['wall', 'floor'],
    ]);
  });

  it('keeps the hand-typed grid as-is when there is no terrain key at all', () => {
    const raw = {
      grid: [
        ['wall', 'floor'],
        ['floor', 'wall'],
      ],
      usSpawns: [],
      enemySpawns: [],
    };
    const layout = loadBattleground(raw, 'greenland');
    expect(layout.grid).toEqual(raw.grid);
  });

  it('rejects a terrain grid whose size does not match the grid', () => {
    const raw = {
      grid: [
        ['wall', 'wall', 'wall', 'wall'],
        ['wall', 'floor', 'floor', 'wall'],
        ['wall', 'wall', 'wall', 'wall'],
      ],
      terrain: [
        ['grass', 'grass', 'grass'],
        ['grass', 'grass', 'grass'],
      ],
      usSpawns: [{ x: 1, y: 1 }],
      enemySpawns: [{ x: 2, y: 1 }],
    };
    expect(() => loadBattleground(raw, 'canada')).toThrow(/"terrain": must be the same size/);
  });
});
