import type { CountryId } from '@/engine/types';
import type { GridPosition, RoomGrid, TileKind } from '@/engine/movement';
import canadaData from './battlegrounds/canada.json';
import greenlandData from './battlegrounds/greenland.json';
import iranData from './battlegrounds/iran.json';
import mexicoData from './battlegrounds/mexico.json';
import panamaData from './battlegrounds/panama.json';
import russiaData from './battlegrounds/russia.json';
import venezuelaData from './battlegrounds/venezuela.json';

/**
 * Per-country battlefield *dressing* (GAME_PLAN §7.1) — layered on top of the plain
 * walkable grid concept `data/battlefield.ts` originally built. User request, alongside a
 * real reference tileset (`public/assets/battle-tiles/source/canada-battle-tileset-sheet.jpg`,
 * a painted Niagara-Falls border-crossing scene plus three tile-panel sections): "build
 * that playground with the tiles provided... those reusable tiles will be needed for
 * other battleground of other countries." So this file, not `battlefield.ts`, is where a
 * country's *look* lives: which terrain texture paints each cell, whether an obstacle
 * renders as a tall cliff block or a flat impassable patch (water), which decorative
 * props (trees, buildings, fences...) sit on top, and where each side's units start.
 * `ui/battle/BattleView.tsx` is the only place any of this becomes pixels.
 *
 * **Every country's actual layout data lives in hand-editable JSON under
 * `data/battlegrounds/`, one file per `CountryId`, not in this file.** User request, once
 * the file-based tile art pipeline (`tile-generation-spec.md`) and a couple of rounds of
 * code-only layout tweaks made it clear that "change one cell" kept meaning "ask Claude to
 * edit TypeScript": *"That would be nice if the battleground where saved in a specific
 * json file with the starting players positions so I can edit them myself."* This file is
 * now just the *loader*: `parseGrid`/`parsePositions`/`parseProps` below validate each
 * JSON file's shape at import time — so a typo (a misspelled terrain name, a missing row,
 * a spawn placed off the edge of the map) throws a clear, specific error the moment the
 * game loads, instead of silently rendering a blank tile or crashing somewhere unrelated
 * later — and wire the result into `getBattleground`. **See `data/battlegrounds/README.md`
 * for the full schema, every valid value, and the coordinate system** (including *why* the
 * river runs on a diagonal instead of a straight column, which matters if you add more
 * water/stonePath cells by hand and want them to stay visually aligned the same way).
 *
 * **Started as Canada-only, generalized to every country on request** (user: "you think
 * you could provide me a little map editor for countries — you forgot the other json
 * files"). The other six countries (`greenland`/`panama`/`mexico`/`iran`/`venezuela`/
 * `russia`) didn't have their own file yet — they were all quietly sharing
 * `data/battlefield.ts`'s one `BATTLEFIELD` grid and `US_SPAWN_POSITIONS`/
 * `ENEMY_SPAWN_POSITIONS` arrays (the old `DEFAULT_BATTLEGROUND`). Each of those six now
 * has its own `data/battlegrounds/<country>.json`, generated once via a lossless dump of
 * that exact shared data (grid + both spawn arrays, verified byte-for-byte round-tripped
 * through `JSON.parse` before being written) so nothing about how any existing battle
 * looks or plays changed — they just each got their *own* copy to edit independently, the
 * same decoupling Canada's spawns already went through in the previous round. None of the
 * six has `terrain`/`props` yet (both fields are optional, see `BattlegroundLayout` below)
 * — they render exactly as before, plain colored diamonds/boxes, until someone (a person,
 * or the new `mapeditor/` tool) paints one.
 *
 * `public/assets/battle-tiles/` is the shared, reusable tile atlas the user's tileset
 * sheet was cropped into — `terrain/` (grass, rocky-ground, stone-path, water, cliff-face,
 * cliff-top) and `props/` (a couple dozen trees/buildings/fences/signs/bench, more than
 * Canada's own layout uses). Any country's battleground can draw on the *same* atlas (plus
 * new terrain art for a biome this sheet doesn't cover yet, e.g. Iran's desert) — never a
 * new one-off painting, and never a new TypeScript file; just hand-editing (or using
 * `mapeditor/`, see below) that country's own `data/battlegrounds/<country>.json`.
 *
 * **`mapeditor/` (repo root, sibling to `src/`) is a small standalone visual editor for
 * these JSON files** — deliberately kept *outside* the game's own build (plain HTML/CSS/JS,
 * no npm dependency, no Vite/React) so it opens directly in a browser with no build step,
 * per the user's own ask ("you can put the code outside the game"). It edits the exact
 * same schema this file loads and validates — see `mapeditor/README.md`.
 *
 * **Grid dimensions are per-file, not a fixed global constant.** User request, right after
 * the map editor's zoom control shipped: *"Thanks for the zoom. I also want to edit the
 * GRID_W and GRID_H."* Every country's grid used to have to be exactly
 * `data/battlefield.ts`'s `BATTLEFIELD_WIDTH`×`BATTLEFIELD_HEIGHT` (20×14) or `parseGrid`
 * threw — so a bigger or smaller battlefield for one country meant either changing that
 * shared constant for every country at once, or a validator rewrite. `parseGrid` below now
 * derives a grid's width from its own first row instead, and only requires the grid be
 * rectangular (every row the same length) — so each country's `grid` defines its own size,
 * and `loadBattleground` reads that size back off the parsed grid to validate `terrain`
 * (must match `grid`'s exact dimensions) and every spawn/prop position (must fall inside
 * `grid`'s own bounds, not a fixed 20×14). This was a clean, scoped change specifically
 * because nothing else in the rendering pipeline hardcodes 20×14: `engine/movement.ts` and
 * `engine/battle.ts` already index a `RoomGrid` purely by `grid[y]?.[x]` with no assumed
 * size, and `ui/room/isometric.ts`'s `isoGridBounds` / `ui/battle/battleCamera.ts`'s
 * `clampCamera` both already derive their bounds from the actual grid array
 * (`grid.length`/`grid[0].length`), not a named constant — confirmed by reading both files
 * before making this change, rather than assuming. `data/battlefield.ts`'s
 * `BATTLEFIELD_WIDTH`/`BATTLEFIELD_HEIGHT`/`BATTLEFIELD` still exist (they're the original
 * shared layout the six non-Canada countries' JSON files were dumped from — see
 * `battlegrounds/README.md`), but nothing here validates against them anymore; every
 * country's actual size now simply comes from its own JSON file, which today all still
 * happen to be 20×14. `mapeditor/`'s width/height resize control (its own README) is the
 * other half of this — it lets someone actually produce a differently-sized file for this
 * loader to accept.
 */

/** What texture paints a cell. Only `'cliff'` changes how the tile is *shaped* — it's
 * the one kind still rendered as a tall extruded `IsoBlock` (the classic obstacle look);
 * every other kind renders as a flat textured diamond, since a river or a grassy
 * tree-stump patch shouldn't stand up off the field the way a rock face does.
 *
 * **Also what determines walkability, whenever a battleground has a `terrain` grid at
 * all** (user request: "The terrain map should be based on the selected background
 * tile. You can walk on grass, rocky ground and stonePath.") — see `WALKABLE_TERRAIN`/
 * `gridFromTerrain` below. Before this, `terrain` was purely cosmetic and `grid` was the
 * one hand-maintained source of truth for both texture-independent walkability *and*
 * look, which meant keeping two parallel layers in sync by hand — real user reports
 * (the "cannot move the player" battle crash earlier this session) trace back to exactly
 * that: spawn tiles whose `grid` cell said `wall` even though they were textured as
 * ordinary walkable ground. Deriving one from the other removes that whole class of bug. */
export type TerrainKind = 'grass' | 'rockyGround' | 'stonePath' | 'water' | 'cliff';

export type TerrainGrid = readonly (readonly TerrainKind[])[];

/** The `TerrainKind`s a unit can stand on — everything else (`water`, `cliff`) blocks
 * movement. See `TerrainKind`'s own doc comment and `gridFromTerrain` below. */
export const WALKABLE_TERRAIN: ReadonlySet<TerrainKind> = new Set<TerrainKind>([
  'grass',
  'rockyGround',
  'stonePath',
]);

/** Derives a walkable `grid` straight from a `terrain` grid: `WALKABLE_TERRAIN` kinds
 * become `'floor'`, everything else becomes `'wall'` — `'object'`/`'door'` never come out
 * of this (see `TILE_KINDS`'s doc comment on `parseGrid` below; battlegrounds never
 * actually use them, only room layouts do). `loadBattleground` calls this whenever a
 * country's file has a `terrain` key at all, so a hand-typed `"grid"` value is only ever
 * the real source of truth for a country with *no* terrain — see this file's top doc
 * comment and `data/battlegrounds/README.md` for the full rationale. Exported so
 * `battlegrounds.test.ts` can exercise it directly, and so a caller that already has a
 * `TerrainGrid` in hand (the map editor mirrors this exact function) never has to
 * reimplement the floor/wall split by hand. */
export function gridFromTerrain(terrain: TerrainGrid): RoomGrid {
  return terrain.map((row) => row.map((cell) => (WALKABLE_TERRAIN.has(cell) ? 'floor' : 'wall')));
}

/** A non-interactive decoration (tree, building, fence...) anchored to one cell, purely
 * visual — it never affects `isWalkable`/pathing on its own, regardless of what `grid`
 * cell (hand-typed or terrain-derived) it happens to sit on. In practice most props sit
 * on a cell that's *also* impassable for a real reason (a border, a cliff, a hand-typed
 * wall) so they don't create an invisible walk-through obstacle — but that's a modeling
 * choice for whoever places the prop, not something this schema enforces; the map
 * editor's live validation flags (without blocking) a prop that ends up on walkable
 * ground. */
export interface BattlegroundProp {
  readonly pos: GridPosition;
  /** Path under `public/assets/battle-tiles/props/`. */
  readonly image: string;
}

export interface BattlegroundLayout {
  readonly grid: RoomGrid;
  /** Same dimensions as `grid` when present; omitted entirely (not just all-`undefined`
   * cells) for a country with no custom look yet, so `BattleTile` can fall back to the
   * original plain rendering with one cheap `terrain === undefined` check rather than
   * walking a grid full of nothing. */
  readonly terrain?: TerrainGrid;
  readonly props?: readonly BattlegroundProp[];
  readonly usSpawns: readonly GridPosition[];
  readonly enemySpawns: readonly GridPosition[];
}

export const TILE_KINDS: ReadonlySet<TileKind> = new Set<TileKind>([
  'floor',
  'wall',
  'object',
  'door',
]);
export const TERRAIN_KINDS: ReadonlySet<TerrainKind> = new Set<TerrainKind>([
  'grass',
  'rockyGround',
  'stonePath',
  'water',
  'cliff',
]);

/** Validates and narrows a hand-edited JSON grid (`battlegrounds/*.json`'s `"grid"` or
 * `"terrain"`) into the typed shape the rest of the game expects. Fails loudly with a
 * specific row/column and the actual bad value — a typo is the most likely real mistake
 * in a hand-edited file, and a thrown error at load time beats a silently wrong tile
 * somewhere on the field nobody would spot by eye.
 *
 * Doesn't check the grid against any fixed size — a grid's width is whatever its own first
 * row's length is, and every other row just has to match it (rectangular). `loadBattleground`
 * is what reads a grid's actual dimensions back out (`grid.length`/`grid[0].length`) to
 * validate everything else (`terrain`, spawns, props) against *that* file's own size. */
export function parseGrid<T extends string>(
  raw: unknown,
  validValues: ReadonlySet<T>,
  label: string,
): readonly (readonly T[])[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(
      `${label}: expected a non-empty array of rows, got ${Array.isArray(raw) ? 'an empty array' : typeof raw}`,
    );
  }
  const width = Array.isArray(raw[0]) ? raw[0].length : 0;
  if (width === 0) {
    throw new Error(
      `${label}: row 0 must be a non-empty array of cells, got ${
        Array.isArray(raw[0]) ? 'an empty array' : typeof raw[0]
      }`,
    );
  }
  return raw.map((row: unknown, y) => {
    if (!Array.isArray(row) || row.length !== width) {
      throw new Error(
        `${label}: every row must have the same length (row 0 has ${width}) — row ${y} has ${
          Array.isArray(row) ? row.length : typeof row
        }`,
      );
    }
    return row.map((cell: unknown, x) => {
      if (typeof cell !== 'string' || !validValues.has(cell as T)) {
        throw new Error(
          `${label}: cell (${x}, ${y}) is ${JSON.stringify(cell)} — must be one of: ${[...validValues].join(', ')}`,
        );
      }
      return cell as T;
    });
  });
}

function parsePosition(raw: unknown, label: string, width: number, height: number): GridPosition {
  const obj = raw as { x?: unknown; y?: unknown } | null;
  if (
    obj === null ||
    typeof obj !== 'object' ||
    typeof obj.x !== 'number' ||
    typeof obj.y !== 'number'
  ) {
    throw new Error(`${label}: expected {"x": number, "y": number}, got ${JSON.stringify(raw)}`);
  }
  const { x, y } = obj;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= width || y < 0 || y >= height) {
    throw new Error(
      `${label}: (${x}, ${y}) must be whole numbers inside the ${width}x${height} grid (x: 0-${
        width - 1
      }, y: 0-${height - 1})`,
    );
  }
  return { x, y };
}

/** `width`/`height` are the *loaded* grid's own dimensions (`grid[0].length`/`grid.length`),
 * not a fixed constant — see `parseGrid`'s doc comment. */
export function parsePositions(
  raw: unknown,
  label: string,
  width: number,
  height: number,
): readonly GridPosition[] {
  if (!Array.isArray(raw)) throw new Error(`${label}: expected an array, got ${typeof raw}`);
  return raw.map((pos, i) => parsePosition(pos, `${label}[${i}]`, width, height));
}

/** `width`/`height` are the *loaded* grid's own dimensions — see `parsePositions`. */
export function parseProps(
  raw: unknown,
  label: string,
  width: number,
  height: number,
): readonly BattlegroundProp[] {
  if (!Array.isArray(raw)) throw new Error(`${label}: expected an array, got ${typeof raw}`);
  return raw.map((entry, i) => {
    const obj = entry as { pos?: unknown; image?: unknown } | null;
    if (obj === null || typeof obj !== 'object' || typeof obj.image !== 'string') {
      throw new Error(
        `${label}[${i}]: expected {"pos": {"x", "y"}, "image": string}, got ${JSON.stringify(entry)}`,
      );
    }
    return { pos: parsePosition(obj.pos, `${label}[${i}].pos`, width, height), image: obj.image };
  });
}

/** Shape a raw `battlegrounds/<country>.json` import is expected to have before
 * validation — deliberately all `unknown` so `loadBattleground` below is the one place
 * that actually trusts (after checking) what a hand-edited file contains. `terrain`/
 * `props` are optional keys, not just `undefined`-valued ones — a country with no custom
 * look simply omits them, same as `BattlegroundLayout` itself. */
interface RawBattlegroundData {
  readonly grid: unknown;
  readonly terrain?: unknown;
  readonly props?: unknown;
  readonly usSpawns: unknown;
  readonly enemySpawns: unknown;
}

/** Validates one country's raw JSON import into a real `BattlegroundLayout`, naming that
 * country in every thrown error so a hand-edit mistake in, say, `iran.json` never gets
 * blamed on the wrong file. Exported (like the validators above) so tests can exercise the
 * dynamic-sizing behavior directly with synthetic raw data, not only via the real committed
 * JSON files (which all happen to be 20×14 today, so wouldn't exercise a different size). */
export function loadBattleground(raw: unknown, country: CountryId): BattlegroundLayout {
  const data = raw as RawBattlegroundData;
  const label = `battlegrounds/${country}.json`;
  // Still parsed and validated in full even though its per-cell values get overridden
  // below when `terrain` is present — this is what establishes the file's width/height
  // and still catches a malformed `"grid"` (wrong row count, an invalid cell value) the
  // same way it always has, for the countries that don't have a `terrain` key at all.
  const parsedGrid = parseGrid(data.grid, TILE_KINDS, `${label} "grid"`);
  const height = parsedGrid.length;
  const width = parsedGrid[0]!.length;
  const terrain =
    data.terrain === undefined
      ? undefined
      : parseGrid(data.terrain, TERRAIN_KINDS, `${label} "terrain"`);
  if (terrain !== undefined && (terrain.length !== height || terrain[0]!.length !== width)) {
    throw new Error(
      `${label} "terrain": must be the same size as "grid" (${width}x${height}), got ${
        terrain[0]?.length ?? 0
      }x${terrain.length}`,
    );
  }
  // Whenever a country has a `terrain` grid at all, it — not the hand-typed `"grid"`
  // values above — is the real source of truth for walkability (`gridFromTerrain`'s own
  // doc comment). A country with no `terrain` key keeps using its plain hand-typed grid,
  // exactly as before this existed.
  const grid = terrain !== undefined ? gridFromTerrain(terrain) : parsedGrid;
  const props =
    data.props === undefined
      ? undefined
      : parseProps(data.props, `${label} "props"`, width, height);
  const usSpawns = parsePositions(data.usSpawns, `${label} "usSpawns"`, width, height);
  const enemySpawns = parsePositions(data.enemySpawns, `${label} "enemySpawns"`, width, height);
  return { grid, terrain, props, usSpawns, enemySpawns };
}

export const CANADA_BATTLEGROUND: BattlegroundLayout = loadBattleground(canadaData, 'canada');
export const GREENLAND_BATTLEGROUND: BattlegroundLayout = loadBattleground(
  greenlandData,
  'greenland',
);
export const PANAMA_BATTLEGROUND: BattlegroundLayout = loadBattleground(panamaData, 'panama');
export const MEXICO_BATTLEGROUND: BattlegroundLayout = loadBattleground(mexicoData, 'mexico');
export const IRAN_BATTLEGROUND: BattlegroundLayout = loadBattleground(iranData, 'iran');
export const VENEZUELA_BATTLEGROUND: BattlegroundLayout = loadBattleground(
  venezuelaData,
  'venezuela',
);
export const RUSSIA_BATTLEGROUND: BattlegroundLayout = loadBattleground(russiaData, 'russia');

const BATTLEGROUNDS: Readonly<Record<CountryId, BattlegroundLayout>> = {
  canada: CANADA_BATTLEGROUND,
  greenland: GREENLAND_BATTLEGROUND,
  panama: PANAMA_BATTLEGROUND,
  mexico: MEXICO_BATTLEGROUND,
  iran: IRAN_BATTLEGROUND,
  venezuela: VENEZUELA_BATTLEGROUND,
  russia: RUSSIA_BATTLEGROUND,
};

export function getBattleground(country: CountryId): BattlegroundLayout {
  return BATTLEGROUNDS[country];
}
