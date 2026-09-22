'use strict';

/*
 * Kakistocracy battleground map editor — a small, dependency-free tool for editing
 * src/data/battlegrounds/<country>.json by hand-clicking instead of hand-typing.
 * Deliberately lives outside the game's own Vite/React build (plain HTML/CSS/JS, no
 * npm install, no bundler) so it opens directly in a browser with no build step — see
 * README.md alongside this file, and src/data/battlegrounds/README.md for the schema
 * this tool reads and writes.
 *
 * The parsing functions below (parseGrid/parsePositions/parseProps) are a deliberate,
 * close port of src/data/battlegrounds.ts's own validators — same rules, same error
 * shapes — so a file loaded here that would fail to load in the real game fails the
 * same way here, and a file this tool exports is guaranteed to satisfy that loader.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// The editor's current canvas size — mutable (not a fixed constant) so the width/height
// resize control can change it, and so loading a file sets it to that file's own actual
// grid size. Mirrors data/battlegrounds.ts's own move away from a fixed GRID_W/GRID_H
// (user request: "I also want to edit the GRID_W and GRID_H").
let gridW = 20;
let gridH = 14;
const GRID_MIN = 3;
const GRID_MAX = 60;

// Isometric zoom (real user feedback: "I cannot pan to the map's corner. Maybe the map
// editor should be isometric too" — see the big isometric-rendering section below).
// CELL_SIZE_DEFAULT is 32 deliberately — the same px value as the real game's own
// ISO_TILE_WIDTH (src/ui/room/isometric.ts) — so at the editor's default zoom, one tile
// is exactly the same size on screen as it is in a real battle.
const CELL_SIZE_DEFAULT = 32;
const CELL_SIZE_MIN = 16;
const CELL_SIZE_MAX = 64;
const CELL_SIZE_STEP = 4;

const TILE_KINDS = ['floor', 'wall', 'object', 'door'];
const TERRAIN_KINDS = ['grass', 'rockyGround', 'stonePath', 'water', 'cliff'];

// Which TERRAIN_KINDS are walkable — mirrors data/battlegrounds.ts's own WALKABLE_TERRAIN
// exactly (hand-ported, not a shared import, same reasoning as every other validator in
// this file: no dependency on the game's own TypeScript/Vite toolchain). User request:
// "The terrain map should be based on the selected background tile. You can walk on
// grass, rocky ground and stonePath." — see `deriveGridFromTerrain` below for how this
// actually gets applied.
const WALKABLE_TERRAIN = new Set(['grass', 'rockyGround', 'stonePath']);

/** Same rule as data/battlegrounds.ts's `gridFromTerrain`: a WALKABLE_TERRAIN cell becomes
 * `'floor'`, everything else becomes `'wall'`. Whenever `state.terrainEnabled` is true,
 * `state.grid` is *always* this function's output — never independently hand-painted —
 * so the editor can never again produce the "spawn tile whose grid cell says wall even
 * though it's textured as ordinary ground" bug that crashed a real battle earlier this
 * session (see battlegrounds.ts's own doc comment on `TerrainKind` for the full story).
 * Only a country with terrain disabled entirely still hand-paints `grid` directly. */
function deriveGridFromTerrain(terrain) {
  return terrain.map((row) => row.map((cell) => (WALKABLE_TERRAIN.has(cell) ? 'floor' : 'wall')));
}

const COUNTRIES = ['canada', 'greenland', 'panama', 'mexico', 'iran', 'venezuela', 'russia'];

// Mirrors data/battleRosters.ts's BATTLE_ROSTERS lengths — used only for the editor's
// own soft "not enough spawn points" warning, so it needs a manual bump here if a
// roster ever grows (same way data/battlefield.ts's own doc comment already tracks it).
const ROSTER_SIZES = {
  canada: 7,
  greenland: 5,
  panama: 3,
  mexico: 3,
  iran: 5,
  venezuela: 3,
  russia: 3,
};
const US_ROSTER_SIZE = 6;

const TERRAIN_IMAGE_FILES = {
  grass: 'grass.png',
  rockyGround: 'rocky-ground.png',
  stonePath: 'stone-path.png',
  water: 'water.png',
  cliff: 'cliff-top.png',
};

// A cliff wall's *side* faces use a separate image from its top face (see the game's
// own `.iso-block.battle-terrain-cliff .iso-face-left/.iso-face-right` in
// src/styles/battle.css) — top.png is the flat rock top a unit could stand near, and
// face.png is the vertical rock face the block's extruded sides show.
const CLIFF_FACE_IMAGE_PATH = '/assets/battle-tiles/terrain/cliff-face.png';

// Every prop image under public/assets/battle-tiles/props/, kept in sync by hand with
// that folder's actual contents (see src/data/battlegrounds/README.md's own copy of
// this same list).
const PROP_FILES = [
  'barrier-checkpoint.png',
  'boat-patrol.png',
  'bridge-steel-stone.png',
  'building-brick-plain.png',
  'building-brick-shop.png',
  'flag-canada.png',
  'flag-us.png',
  'forest-pine-cluster.png',
  'forest-round-cluster.png',
  'gate-iron.png',
  'jeep.png',
  'rock-pile.png',
  'sandbags-crates.png',
  'tent-canvas.png',
  'tent-medic.png',
  'watchtower.png',
];
const PROP_IMAGES = PROP_FILES.map((f) => `/assets/battle-tiles/props/${f}`);

/** The schema's image paths are site-root-relative ("/assets/..."), matching how Vite
 * serves `public/` at runtime. This editor lives at the repo root, so the same path
 * resolves to the real file on disk via a plain relative `../public` prefix — this
 * works for <img>/CSS background-image even opened directly as a file:// page, unlike
 * fetch()/XHR, which most browsers block for local files. */
function assetPathToRelative(assetPath) {
  return assetPath.startsWith('/') ? `../public${assetPath}` : assetPath;
}

const TERRAIN_IMAGES = Object.fromEntries(
  Object.entries(TERRAIN_IMAGE_FILES).map(([kind, file]) => [
    kind,
    assetPathToRelative(`/assets/battle-tiles/terrain/${file}`),
  ]),
);
const CLIFF_FACE_IMAGE = assetPathToRelative(CLIFF_FACE_IMAGE_PATH);

// ---------------------------------------------------------------------------
// Isometric projection (ported from src/ui/room/isometric.ts) — real user feedback:
// "I cannot pan to the map's corner. Maybe the map editor should be isometric too."
// This editor used to render a plain top-down CSS grid, which made a hand-placed
// position genuinely hard to picture the way the real 2:1 dimetric battle camera
// (`ui/room/isometric.ts`'s doc comment, GAME_PLAN §11) actually shows it — two cells
// that look "close" in a flat grid can land in completely different screen diagonals
// once projected. This section is a close port of that file's `projectIso`/
// `isoGridBounds`/`isoDepth`/`buildCubeFaces`, scaled by the editor's own zoom slider
// (`cellSize`) instead of a fixed constant, so "zoom" here changes real tile geometry
// rather than a CSS-only visual scale — every cell's on-screen position depends on tile
// size, so a zoom change rebuilds the grid DOM (see `setCellSize` below) rather than
// just tweaking a CSS custom property the way the old flat grid's zoom did.
//
// Panning: deliberately NOT a hand-rolled camera/clamp (unlike the real battle
// screen's `ui/battle/battleCamera.ts`, which tracks its own camera offset and clamps
// it to the grid's edges) — `#iso-viewport` below is a plain `overflow: auto` box, so
// panning is the browser's own native scrolling (scrollbars, trackpad, wheel, and — for
// free, since the viewport is a focusable, scrollable container — arrow keys/Page
// Up/Down/Home/End). This sidesteps an entire class of "camera won't reach the actual
// edge" bug a custom clamp can have; an editor has no reason to reimplement that when
// the platform already does it correctly.
const ISO_TILE_WIDTH_BASE = 32;
const ISO_TILE_HEIGHT_BASE = 16;
const ISO_WALL_HEIGHT_BASE = 22;

function isoTileWidth() {
  return cellSize;
}
function isoTileHeight() {
  return cellSize / 2;
}
function isoWallHeight() {
  return cellSize * (ISO_WALL_HEIGHT_BASE / ISO_TILE_WIDTH_BASE);
}

/** Projects a grid cell to the center of its diamond, in an unbounded coordinate space
 * (can be negative — see `isoGridBounds` for turning this into on-screen coordinates). */
function projectIso(x, y) {
  return { x: (x - y) * (isoTileWidth() / 2), y: (x + y) * (isoTileHeight() / 2) };
}

/** The bounding box of every cell in a `width x height` grid once projected, plus
 * margin for one tile's diamond and the tallest wall block, so nothing clips at the
 * edges of `#iso-world`. */
function isoGridBounds(width, height) {
  const corners = [
    [0, 0],
    [width - 1, 0],
    [0, height - 1],
    [width - 1, height - 1],
  ];
  const points = corners.map(([x, y]) => projectIso(x, y));
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const offsetX = isoTileWidth() / 2 - minX;
  const offsetY = isoTileHeight() / 2 - minY;
  return {
    width: maxX - minX + isoTileWidth(),
    height: maxY - minY + isoTileHeight() + isoWallHeight(),
    offsetX,
    offsetY,
  };
}

/** Projects `(x, y)` into `isoBounds`'s coordinate space — ready to use directly as a
 * CSS `left`/`top` anchor within `#iso-world`. */
function projectIsoWithin(x, y, bounds) {
  const p = projectIso(x, y);
  return { x: p.x + bounds.offsetX, y: p.y + bounds.offsetY };
}

/** Painter's-algorithm draw order: cells further down-and-right on the grid (bigger
 * `x + y`) sit closer to the camera, so they must be drawn later (on top). Multiplied
 * by 10 wherever it's used as an actual `z-index`, same as the real game, leaving room
 * for a prop/spawn-marker overlay to sit just above its own tile (`depth * 10 + 1`). */
function isoDepth(x, y) {
  return x + y;
}

/** `clip-path: polygon(...)` strings for the three visible faces of an isometric block
 * of footprint `width x height` standing `depth` px tall. */
function buildCubeFaces(width, height, depth) {
  const halfW = width / 2;
  const halfH = height / 2;
  return {
    top: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
    left: `polygon(0px 0px, ${halfW}px ${halfH}px, ${halfW}px ${halfH + depth}px, 0px ${depth}px)`,
    right: `polygon(0px ${halfH}px, ${halfW}px 0px, ${halfW}px ${depth}px, 0px ${halfH + depth}px)`,
  };
}

// ---------------------------------------------------------------------------
// Parsing / validation (ported from src/data/battlegrounds.ts)
// ---------------------------------------------------------------------------

// Derives a grid's own width from its first row (no fixed-size check) and only requires
// the grid be rectangular — same rule as the real loader's parseGrid, now that grid size is
// per-file rather than a fixed GRID_W/GRID_H (see data/battlegrounds.ts's own doc comment).
function parseGrid(raw, validValues, label) {
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
  return raw.map((row, y) => {
    if (!Array.isArray(row) || row.length !== width) {
      throw new Error(
        `${label}: every row must have the same length (row 0 has ${width}) — row ${y} has ${
          Array.isArray(row) ? row.length : typeof row
        }`,
      );
    }
    return row.map((cell, x) => {
      if (typeof cell !== 'string' || !validValues.includes(cell)) {
        throw new Error(
          `${label}: cell (${x}, ${y}) is ${JSON.stringify(cell)} — must be one of: ${validValues.join(', ')}`,
        );
      }
      return cell;
    });
  });
}

// width/height are the loaded grid's own dimensions, not a fixed constant — see parseGrid.
function parsePosition(raw, label, width, height) {
  const obj = raw;
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
      `${label}: (${x}, ${y}) must be whole numbers inside the ${width}x${height} grid (x: 0-${width - 1}, y: 0-${height - 1})`,
    );
  }
  return { x, y };
}

function parsePositions(raw, label, width, height) {
  if (!Array.isArray(raw)) throw new Error(`${label}: expected an array, got ${typeof raw}`);
  return raw.map((pos, i) => parsePosition(pos, `${label}[${i}]`, width, height));
}

function parseProps(raw, label, width, height) {
  if (!Array.isArray(raw)) throw new Error(`${label}: expected an array, got ${typeof raw}`);
  return raw.map((entry, i) => {
    const obj = entry;
    if (obj === null || typeof obj !== 'object' || typeof obj.image !== 'string') {
      throw new Error(
        `${label}[${i}]: expected {"pos": {"x", "y"}, "image": string}, got ${JSON.stringify(entry)}`,
      );
    }
    return { pos: parsePosition(obj.pos, `${label}[${i}].pos`, width, height), image: obj.image };
  });
}

/** Loads and validates a raw parsed-JSON object into editor state, throwing the same
 * kind of specific error the real game's loader would on a malformed hand-edit. The
 * returned state's grid can be any size — width/height are read off the grid itself, same
 * as data/battlegrounds.ts's own loadBattleground; the caller (applyLoadedState) is
 * responsible for pointing the editor's gridW/gridH at that size.
 *
 * The raw `"grid"` is still fully parsed/validated (it establishes width/height, and a
 * malformed value still throws), but when the file has a `"terrain"` key, the *returned*
 * grid is `deriveGridFromTerrain(terrain)`, not the raw hand-typed values — same override
 * `data/battlegrounds.ts`'s `loadBattleground` applies, so a file loaded here and a file
 * loaded by the real game always agree on walkability. */
function loadIntoState(raw, country) {
  const label = `${country}.json`;
  const parsedGrid = parseGrid(raw.grid, TILE_KINDS, `${label} "grid"`);
  const height = parsedGrid.length;
  const width = parsedGrid[0].length;
  const hasTerrain = raw.terrain !== undefined;
  const terrain = hasTerrain ? parseGrid(raw.terrain, TERRAIN_KINDS, `${label} "terrain"`) : null;
  if (terrain && (terrain.length !== height || terrain[0].length !== width)) {
    throw new Error(
      `${label} "terrain": must be the same size as "grid" (${width}x${height}), got ${
        terrain[0] ? terrain[0].length : 0
      }x${terrain.length}`,
    );
  }
  const grid = terrain ? deriveGridFromTerrain(terrain) : parsedGrid;
  const props =
    raw.props === undefined ? [] : parseProps(raw.props, `${label} "props"`, width, height);
  const usSpawns = parsePositions(raw.usSpawns, `${label} "usSpawns"`, width, height);
  const enemySpawns = parsePositions(raw.enemySpawns, `${label} "enemySpawns"`, width, height);
  return {
    country,
    grid: grid.map((row) => row.slice()),
    terrainEnabled: hasTerrain,
    terrain: terrain ? terrain.map((row) => row.slice()) : createDefaultTerrain(width, height),
    props: props.slice(),
    usSpawns: usSpawns.slice(),
    enemySpawns: enemySpawns.slice(),
  };
}

function createDefaultTerrain(width, height) {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => 'grass'));
}

function createBlankGrid(width, height) {
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      row.push(border ? 'wall' : 'floor');
    }
    rows.push(row);
  }
  return rows;
}

function createBlankState(country) {
  return {
    country,
    grid: createBlankGrid(gridW, gridH),
    terrainEnabled: false,
    terrain: createDefaultTerrain(gridW, gridH),
    props: [],
    usSpawns: [],
    enemySpawns: [],
  };
}

// ---------------------------------------------------------------------------
// Serialization — matches this repo's actual Prettier JSON style (arrays always one
// element per line, small {x,y}/prop objects collapsed onto one line) so an exported
// file needs no reformatting pass and produces a clean git diff.
// ---------------------------------------------------------------------------

function ind(n) {
  return ' '.repeat(n);
}

function serializeGrid(grid, baseIndent) {
  const rowIndent = baseIndent + 2;
  const cellIndent = baseIndent + 4;
  const rows = grid.map((row) => {
    const cells = row.map((c) => `${ind(cellIndent)}${JSON.stringify(c)}`).join(',\n');
    return `${ind(rowIndent)}[\n${cells}\n${ind(rowIndent)}]`;
  });
  return `[\n${rows.join(',\n')}\n${ind(baseIndent)}]`;
}

function serializePositions(positions, baseIndent) {
  if (positions.length === 0) return '[]';
  const itemIndent = baseIndent + 2;
  const items = positions.map((p) => `${ind(itemIndent)}{ "x": ${p.x}, "y": ${p.y} }`).join(',\n');
  return `[\n${items}\n${ind(baseIndent)}]`;
}

function serializeProps(props, baseIndent) {
  if (props.length === 0) return '[]';
  const itemIndent = baseIndent + 2;
  const items = props
    .map(
      (p) =>
        `${ind(itemIndent)}{ "pos": { "x": ${p.pos.x}, "y": ${p.pos.y} }, "image": ${JSON.stringify(p.image)} }`,
    )
    .join(',\n');
  return `[\n${items}\n${ind(baseIndent)}]`;
}

function serializeState(state) {
  const parts = [`  "grid": ${serializeGrid(state.grid, 2)}`];
  if (state.terrainEnabled) {
    parts.push(`  "terrain": ${serializeGrid(state.terrain, 2)}`);
  }
  if (state.props.length > 0) {
    parts.push(`  "props": ${serializeProps(state.props, 2)}`);
  }
  parts.push(`  "usSpawns": ${serializePositions(state.usSpawns, 2)}`);
  parts.push(`  "enemySpawns": ${serializePositions(state.enemySpawns, 2)}`);
  return `{\n${parts.join(',\n')}\n}\n`;
}

// ---------------------------------------------------------------------------
// Validation (soft warnings — the editor's own painting can't produce a structurally
// invalid file, so these only flag things that are legal but probably a mistake)
// ---------------------------------------------------------------------------

function findDuplicates(positions) {
  const seen = new Set();
  const dups = [];
  for (const p of positions) {
    const key = `${p.x},${p.y}`;
    if (seen.has(key)) dups.push(p);
    else seen.add(key);
  }
  return dups;
}

function validateState(state) {
  const messages = [];
  const offFloor = [];
  for (const p of state.usSpawns) {
    if (state.grid[p.y][p.x] !== 'floor') offFloor.push(`US (${p.x}, ${p.y})`);
  }
  for (const p of state.enemySpawns) {
    if (state.grid[p.y][p.x] !== 'floor') offFloor.push(`Enemy (${p.x}, ${p.y})`);
  }
  if (offFloor.length > 0) {
    messages.push(`Spawn(s) not on a floor tile: ${offFloor.join(', ')}.`);
  }

  const usDups = findDuplicates(state.usSpawns);
  const enemyDups = findDuplicates(state.enemySpawns);
  if (usDups.length > 0) messages.push(`${usDups.length} duplicate US spawn position(s).`);
  if (enemyDups.length > 0) messages.push(`${enemyDups.length} duplicate enemy spawn position(s).`);

  if (state.usSpawns.length < US_ROSTER_SIZE) {
    messages.push(
      `Only ${state.usSpawns.length} US spawn point(s) — the US cabinet always fields ${US_ROSTER_SIZE}. Missing units simply won't appear.`,
    );
  }
  const rosterSize = ROSTER_SIZES[state.country] ?? 0;
  if (state.enemySpawns.length < rosterSize) {
    messages.push(
      `Only ${state.enemySpawns.length} enemy spawn point(s) — ${state.country}'s roster has ${rosterSize} units. Missing units simply won't appear.`,
    );
  }

  const propsOnFloor = state.props.filter((p) => state.grid[p.pos.y][p.pos.x] === 'floor');
  if (propsOnFloor.length > 0) {
    messages.push(
      state.terrainEnabled
        ? `${propsOnFloor.length} prop(s) sit on a walkable terrain cell (grass, rockyGround or stonePath) — units can walk right through them. Paint that cell as water or cliff on the Terrain layer if the prop should block movement.`
        : `${propsOnFloor.length} prop(s) sit on a "floor" cell — units can walk right through them. Set that cell to "wall" too if the prop should block movement.`,
    );
  }

  const unknownProps = state.props.filter((p) => !PROP_IMAGES.includes(p.image));
  if (unknownProps.length > 0) {
    messages.push(
      `${unknownProps.length} prop(s) use an image path not in the known props list — double-check the filename.`,
    );
  }

  return messages;
}

// ---------------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------------

let state = null; // set on load
let activeLayer = 'grid';
let activeTool = 'floor';
let painting = false;
let paintAction = null; // 'add' | 'remove', for spawn layers only
let fsaFileHandle = null; // File System Access API handle, when available & used

// The editor's current zoom (px, same unit as the real game's ISO_TILE_WIDTH) —
// declared here, ahead of buildGridDom()'s first call, since every isometric
// projection function above reads it. Changing it rebuilds the grid DOM (see
// `setCellSize`), unlike the old flat grid's zoom, which was a pure CSS custom
// property with no geometry to recompute.
let cellSize = CELL_SIZE_DEFAULT;

// Rebuilt by buildGridDom() every time gridW/gridH/cellSize change (a load, a blank
// map, a resize, or a zoom) — no longer a fixed-size array built once.
let cellEls = [];

// The current grid's projected bounding box (`isoGridBounds`), recomputed by every
// buildGridDom() call — every cell/prop/spawn-marker position is projected within it.
let isoBounds = { width: 0, height: 0, offsetX: 0, offsetY: 0 };

// Prop and spawn-marker overlay DOM nodes (direct children of #iso-world, siblings of
// the cell nodes below) — tracked separately so renderOverlays() can cheaply clear and
// rebuild just these, without touching the (potentially much more numerous) tile cells.
let overlayEls = [];

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const el = {
  countrySelect: document.getElementById('country-select'),
  btnAutoload: document.getElementById('btn-autoload'),
  btnOpenFile: document.getElementById('btn-openfile'),
  fileInput: document.getElementById('file-input'),
  btnBlank: document.getElementById('btn-blank'),
  btnFsaOpen: document.getElementById('btn-fsa-open'),
  btnDownload: document.getElementById('btn-download'),
  btnFsaSave: document.getElementById('btn-fsa-save'),
  btnCopy: document.getElementById('btn-copy'),
  statusBar: document.getElementById('status-bar'),
  layerTabs: document.getElementById('layer-tabs'),
  toolPalette: document.getElementById('tool-palette'),
  layerHint: document.getElementById('layer-hint'),
  isoViewport: document.getElementById('iso-viewport'),
  isoWorld: document.getElementById('iso-world'),
  legend: document.getElementById('legend'),
  validationList: document.getElementById('validation-list'),
  btnZoomOut: document.getElementById('btn-zoom-out'),
  btnZoomIn: document.getElementById('btn-zoom-in'),
  btnZoomReset: document.getElementById('btn-zoom-reset'),
  zoomSlider: document.getElementById('zoom-slider'),
  zoomLabel: document.getElementById('zoom-label'),
  gridWidthInput: document.getElementById('grid-width-input'),
  gridHeightInput: document.getElementById('grid-height-input'),
  btnResize: document.getElementById('btn-resize'),
};

// ---------------------------------------------------------------------------
// Status bar
// ---------------------------------------------------------------------------

function setStatus(text, kind) {
  el.statusBar.textContent = text;
  el.statusBar.className = kind ? kind : '';
}

// ---------------------------------------------------------------------------
// Grid DOM — isometric (rebuilt whenever gridW/gridH/cellSize change: a load, a blank
// map, a resize, or a zoom). Every cell is its own absolutely-positioned element inside
// `#iso-world` (a diamond for floor/object/door/wall-with-flat-terrain, or a 3-face
// extruded block for a real wall — see `renderCell`'s doc comment below), rather than a
// CSS-grid row/column layout — this is what actually makes the editor isometric.
// ---------------------------------------------------------------------------

/** One flat diamond tile — floor/object/door, or a wall tile whose terrain isn't
 * "cliff" (a river, or a grassy tile a tree prop stands on — impassable per the grid
 * either way, but shouldn't stand up off the field like a rock). `tileClass` is a
 * `tile-*` class purely for its fallback color; `terrainKind` (when given) paints a
 * real texture over it via `background-image`, same as the real game. */
function makeDiamondCell(x, y, tileClass, terrainKind) {
  const point = projectIsoWithin(x, y, isoBounds);
  const cell = document.createElement('div');
  cell.className = `iso-cell tile-${tileClass}`;
  cell.style.left = `${point.x}px`;
  cell.style.top = `${point.y}px`;
  cell.style.width = `${isoTileWidth()}px`;
  cell.style.height = `${isoTileHeight()}px`;
  cell.style.zIndex = String(isoDepth(x, y) * 10);
  if (terrainKind) {
    cell.style.backgroundImage = `url("${TERRAIN_IMAGES[terrainKind]}")`;
  }
  return cell;
}

/** A real wall: a 3-face extruded block (top/left/right, same `buildCubeFaces` math as
 * the real game), standing `isoWallHeight()` px tall above its footprint. Its hit
 * target is the whole (non-clipped) bounding rectangle, not just the top diamond — a
 * deliberate, documented simplification (see this file's isometric-projection doc
 * comment): a tall block visually overlaps part of the row behind it on screen, so a
 * pixel-perfect click target would need to hit-test through 3 separate clip-paths.
 * Clicking anywhere on a wall's silhouette selecting that wall is a fine tradeoff for a
 * hand-editing tool — zoom in for more precision if two walls' rectangles ever get hard
 * to tell apart. `terrainKind === 'cliff'` paints real rock-face textures; anything
 * else (including no terrain layer at all) is a plain colored block, same fallback
 * `--color-wall` the flat top-down editor always used. */
function makeBlockCell(x, y, terrainKind) {
  const point = projectIsoWithin(x, y, isoBounds);
  const w = isoTileWidth();
  const h = isoTileHeight();
  const depth = isoWallHeight();
  const halfW = w / 2;
  const halfH = h / 2;
  const faces = buildCubeFaces(w, h, depth);
  const isCliff = terrainKind === 'cliff';

  const block = document.createElement('div');
  block.className = 'iso-block tile-wall';
  block.style.left = `${point.x - halfW}px`;
  block.style.top = `${point.y - halfH}px`;
  block.style.width = `${w}px`;
  block.style.height = `${h + depth}px`;
  block.style.zIndex = String(isoDepth(x, y) * 10);

  const top = document.createElement('div');
  top.className = 'iso-face iso-face-top';
  top.style.width = `${w}px`;
  top.style.height = `${h}px`;
  top.style.clipPath = faces.top;
  if (isCliff) top.style.backgroundImage = `url("${TERRAIN_IMAGES.cliff}")`;

  const left = document.createElement('div');
  left.className = 'iso-face iso-face-left';
  left.style.top = `${halfH}px`;
  left.style.width = `${halfW}px`;
  left.style.height = `${halfH + depth}px`;
  left.style.clipPath = faces.left;
  if (isCliff) left.style.backgroundImage = `url("${CLIFF_FACE_IMAGE}")`;

  const right = document.createElement('div');
  right.className = 'iso-face iso-face-right';
  right.style.top = `${halfH}px`;
  right.style.left = `${halfW}px`;
  right.style.width = `${halfW}px`;
  right.style.height = `${halfH + depth}px`;
  right.style.clipPath = faces.right;
  if (isCliff) right.style.backgroundImage = `url("${CLIFF_FACE_IMAGE}")`;

  block.appendChild(top);
  block.appendChild(left);
  block.appendChild(right);
  return block;
}

function attachCellListeners(node, x, y) {
  node.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    onCellPointerDown(x, y);
  });
  node.addEventListener('pointerenter', () => onCellPointerEnter(x, y));
}

function buildGridDom() {
  isoBounds = isoGridBounds(gridW, gridH);
  el.isoWorld.style.width = `${isoBounds.width}px`;
  el.isoWorld.style.height = `${isoBounds.height}px`;
  el.isoWorld.innerHTML = '';
  cellEls = Array.from({ length: gridH }, () => Array(gridW).fill(null));
  overlayEls = []; // innerHTML = '' above already removed their DOM nodes
}

function renderGrid() {
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      renderCell(x, y);
    }
  }
  renderOverlays();
}

/** Rebuilds one cell's DOM node from scratch (removes the old one, if any, and
 * replaces it) — a tile's *shape* can change (a wall toggling between a flat diamond
 * and an extruded block as its terrain changes), not just its color/texture, so this
 * always creates a fresh node rather than patching the existing one in place. Called
 * for the whole grid by `renderGrid()`, and for a single touched cell by `applyPaint`
 * on every paint step — cheap either way, since only the one cell that actually changed
 * gets rebuilt during painting, same granularity the old flat-grid editor had. */
function renderCell(x, y) {
  const old = cellEls[y] ? cellEls[y][x] : null;
  if (old && old.parentNode) old.parentNode.removeChild(old);

  let node;
  if (!state) {
    node = makeDiamondCell(x, y, 'empty', undefined);
  } else {
    const tile = state.grid[y][x];
    const terrainKind = state.terrainEnabled ? state.terrain[y][x] : undefined;
    const isBlock = tile === 'wall' && (!state.terrainEnabled || terrainKind === 'cliff');
    node = isBlock ? makeBlockCell(x, y, terrainKind) : makeDiamondCell(x, y, tile, terrainKind);
  }
  attachCellListeners(node, x, y);
  el.isoWorld.appendChild(node);
  if (!cellEls[y]) cellEls[y] = [];
  cellEls[y][x] = node;
}

// ---------------------------------------------------------------------------
// Prop & spawn-marker overlays — direct children of #iso-world (siblings of the cell
// nodes above, not nested inside them), same structure the real game uses
// (`BattleProp`/`BattleUnitToken` as separate absolutely-positioned children of
// `.battle-grid-iso`, not nested in `BattleTile`) — that's what lets each overlay's own
// `isoDepth`-based z-index interleave correctly with every tile's, rather than being
// stuck entirely in front of or behind whichever tile it happens to be nested inside.
// ---------------------------------------------------------------------------

function clearOverlays() {
  for (const node of overlayEls) {
    if (node.parentNode) node.parentNode.removeChild(node);
  }
  overlayEls = [];
}

function makeSpawnMarker(x, y, side, num) {
  const point = projectIsoWithin(x, y, isoBounds);
  const size = Math.max(10, isoTileHeight() * 1.1);
  const marker = document.createElement('div');
  marker.className = `iso-spawn-marker ${side}`;
  marker.textContent = String(num);
  marker.style.left = `${point.x}px`;
  marker.style.top = `${point.y}px`;
  marker.style.width = `${size}px`;
  marker.style.height = `${size}px`;
  marker.style.fontSize = `${Math.max(8, size * 0.42)}px`;
  marker.style.zIndex = String(isoDepth(x, y) * 10 + 2);
  return marker;
}

function renderOverlays() {
  clearOverlays();
  if (!state) return;
  for (const prop of state.props) {
    const point = projectIsoWithin(prop.pos.x, prop.pos.y, isoBounds);
    const img = document.createElement('img');
    img.className = 'iso-prop-overlay';
    img.src = assetPathToRelative(prop.image);
    img.alt = '';
    img.style.left = `${point.x}px`;
    img.style.top = `${point.y}px`;
    img.style.width = `${isoTileWidth()}px`;
    img.style.height = `${isoTileWidth()}px`;
    img.style.zIndex = String(isoDepth(prop.pos.x, prop.pos.y) * 10 + 1);
    el.isoWorld.appendChild(img);
    overlayEls.push(img);
  }
  state.usSpawns.forEach((p, i) => {
    const marker = makeSpawnMarker(p.x, p.y, 'us', i + 1);
    el.isoWorld.appendChild(marker);
    overlayEls.push(marker);
  });
  state.enemySpawns.forEach((p, i) => {
    const marker = makeSpawnMarker(p.x, p.y, 'enemy', i + 1);
    el.isoWorld.appendChild(marker);
    overlayEls.push(marker);
  });
}

// ---------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------

function onCellPointerDown(x, y) {
  if (!state) return;
  painting = true;
  applyPaint(x, y, true);
}

function onCellPointerEnter(x, y) {
  if (!painting || !state) return;
  applyPaint(x, y, false);
}

function isSpawnAt(x, y, layer) {
  const arr = layer === 'spawnsUs' ? state.usSpawns : state.enemySpawns;
  return arr.some((p) => p.x === x && p.y === y);
}

function setSpawn(x, y, layer, present) {
  const key = layer === 'spawnsUs' ? 'usSpawns' : 'enemySpawns';
  const arr = state[key];
  const idx = arr.findIndex((p) => p.x === x && p.y === y);
  if (present && idx === -1) arr.push({ x, y });
  if (!present && idx !== -1) arr.splice(idx, 1);
}

function setProp(x, y, tool) {
  const idx = state.props.findIndex((p) => p.pos.x === x && p.pos.y === y);
  if (tool.type === 'erase') {
    if (idx !== -1) state.props.splice(idx, 1);
    return;
  }
  const entry = { pos: { x, y }, image: tool.image };
  if (idx !== -1) state.props[idx] = entry;
  else state.props.push(entry);
}

function applyPaint(x, y, isFirst) {
  switch (activeLayer) {
    case 'grid':
      // Once terrain is enabled, grid is *derived*, not hand-painted (user request: "The
      // terrain map should be based on the selected background tile") — see
      // deriveGridFromTerrain and the 'terrain' case below. renderToolPalette already
      // hides this layer's swatches in that state (so this shouldn't normally even be
      // reachable), but guard here too in case a click lands mid-transition.
      if (state.terrainEnabled) return;
      state.grid[y][x] = activeTool;
      // Grid kind can change which shape this cell renders as (flat diamond
      // vs. extruded block), so the tile DOM node itself needs rebuilding.
      renderCell(x, y);
      break;
    case 'terrain':
      if (!state.terrainEnabled) return;
      state.terrain[y][x] = activeTool;
      // Terrain is the walkability source of truth whenever it's enabled — every paint
      // recomputes this one cell's grid value too, not just its texture, so the two can
      // never drift apart the way they used to (see WALKABLE_TERRAIN's doc comment).
      state.grid[y][x] = WALKABLE_TERRAIN.has(activeTool) ? 'floor' : 'wall';
      // Terrain can also flip a wall cell between "cliff block" and "flat
      // textured wall diamond" (see renderCell's isBlock rule), so rebuild.
      renderCell(x, y);
      break;
    case 'props':
      setProp(x, y, activeTool);
      // Props are overlay siblings of the tile grid, not part of the cell
      // node itself — rebuild the overlay layer, not the cell.
      renderOverlays();
      break;
    case 'spawnsUs':
    case 'spawnsEnemy':
      if (isFirst) {
        paintAction = isSpawnAt(x, y, activeLayer) ? 'remove' : 'add';
      }
      setSpawn(x, y, activeLayer, paintAction === 'add');
      // Same as props: spawn markers are overlay siblings.
      renderOverlays();
      break;
    default:
      return;
  }
  renderValidation();
}

// ---------------------------------------------------------------------------
// Tool palette
// ---------------------------------------------------------------------------

const TILE_COLORS = {
  floor: '#e4d9b8',
  wall: '#4a4a4a',
  object: '#7a5a9a',
  door: '#8a6a3a',
};

function makeSwatch({ label, colorSwatch, imgSrc, isActive, onClick }) {
  const row = document.createElement('div');
  row.className = 'tool-swatch' + (isActive ? ' active' : '');
  if (colorSwatch) {
    const sw = document.createElement('span');
    sw.className = 'swatch-color';
    sw.style.background = colorSwatch;
    row.appendChild(sw);
  } else if (imgSrc) {
    const img = document.createElement('img');
    img.src = imgSrc;
    img.alt = '';
    row.appendChild(img);
  }
  const text = document.createElement('span');
  text.textContent = label;
  row.appendChild(text);
  row.addEventListener('click', onClick);
  return row;
}

function renderToolPalette() {
  el.toolPalette.innerHTML = '';
  if (!state) {
    el.layerHint.textContent = 'Load a country to start editing.';
    return;
  }

  if (activeLayer === 'grid') {
    if (state.terrainEnabled) {
      // Terrain is the walkability source of truth once enabled (user request: "The
      // terrain map should be based on the selected background tile") — grid is derived,
      // not hand-painted, so there's nothing to pick here. See deriveGridFromTerrain.
      el.layerHint.textContent =
        'Terrain is enabled, so walkability is derived automatically from the Terrain layer (grass, rockyGround and stonePath are walkable; water and cliff are not). Switch to the Terrain layer to change it, or disable terrain above to hand-paint grid again.';
      return;
    }
    el.layerHint.textContent = 'Pick a tile kind, then click or drag across the grid to paint it.';
    for (const kind of TILE_KINDS) {
      el.toolPalette.appendChild(
        makeSwatch({
          label: kind,
          colorSwatch: TILE_COLORS[kind],
          isActive: activeTool === kind,
          onClick: () => {
            activeTool = kind;
            renderToolPalette();
          },
        }),
      );
    }
  } else if (activeLayer === 'terrain') {
    const checkboxRow = document.createElement('label');
    checkboxRow.className = 'tool-checkbox';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.terrainEnabled;
    checkbox.addEventListener('change', () => {
      state.terrainEnabled = checkbox.checked;
      if (state.terrainEnabled) {
        // Mirrors loadBattleground/loadIntoState: whenever terrain governs walkability,
        // grid is fully re-derived from it, not merged or left as whatever was last
        // hand-painted.
        state.grid = deriveGridFromTerrain(state.terrain);
      }
      renderGrid();
      renderToolPalette();
      renderValidation();
    });
    checkboxRow.appendChild(checkbox);
    checkboxRow.appendChild(document.createTextNode(' Enable terrain layer'));
    el.toolPalette.appendChild(checkboxRow);

    if (!state.terrainEnabled) {
      el.layerHint.textContent =
        'Terrain is off — this country renders as plain colored tiles, same as before this system existed. Check the box above to paint real textures.';
      return;
    }
    el.layerHint.textContent = 'Pick a texture, then click or drag across the grid to paint it.';
    if (!TERRAIN_KINDS.includes(activeTool)) activeTool = TERRAIN_KINDS[0];
    for (const kind of TERRAIN_KINDS) {
      el.toolPalette.appendChild(
        makeSwatch({
          label: kind,
          imgSrc: TERRAIN_IMAGES[kind],
          isActive: activeTool === kind,
          onClick: () => {
            activeTool = kind;
            renderToolPalette();
          },
        }),
      );
    }
  } else if (activeLayer === 'props') {
    el.layerHint.textContent = state.terrainEnabled
      ? 'Pick a prop (or the eraser), then click a cell to place/remove it. Props are decorative — paint that cell as water or cliff on the Terrain layer too if it should block movement.'
      : 'Pick a prop (or the eraser), then click a cell to place/remove it. Props are decorative — set the cell to "wall" on the Grid layer too if it should block movement.';
    if (!activeTool || (activeTool.type !== 'erase' && activeTool.type !== 'prop')) {
      activeTool = { type: 'erase' };
    }
    el.toolPalette.appendChild(
      makeSwatch({
        label: 'Eraser',
        colorSwatch: '#00000000',
        isActive: activeTool.type === 'erase',
        onClick: () => {
          activeTool = { type: 'erase' };
          renderToolPalette();
        },
      }),
    );
    for (const image of PROP_IMAGES) {
      const fileLabel = image.split('/').pop().replace('.png', '');
      el.toolPalette.appendChild(
        makeSwatch({
          label: fileLabel,
          imgSrc: assetPathToRelative(image),
          isActive: activeTool.type === 'prop' && activeTool.image === image,
          onClick: () => {
            activeTool = { type: 'prop', image };
            renderToolPalette();
          },
        }),
      );
    }
  } else {
    // spawnsUs / spawnsEnemy
    const side = activeLayer === 'spawnsUs' ? 'US' : 'enemy';
    el.layerHint.textContent = `Click a cell to add or remove a ${side} starting position. Numbers show spawn order (spawn 1 is assigned to the first unit, and so on).`;
  }
}

// ---------------------------------------------------------------------------
// Legend & validation
// ---------------------------------------------------------------------------

function renderLegend() {
  el.legend.innerHTML = '';
  const rows = [
    ['floor', TILE_COLORS.floor],
    ['wall', TILE_COLORS.wall],
    ['object', TILE_COLORS.object],
    ['door', TILE_COLORS.door],
  ];
  for (const [label, color] of rows) {
    const row = document.createElement('div');
    row.className = 'legend-row';
    const sw = document.createElement('span');
    sw.className = 'legend-swatch';
    sw.style.background = color;
    row.appendChild(sw);
    row.appendChild(document.createTextNode(label));
    el.legend.appendChild(row);
  }
  const usRow = document.createElement('div');
  usRow.className = 'legend-row';
  usRow.innerHTML = `<span class="legend-swatch" style="background:#3a6ea5;border-radius:50%"></span> US spawn`;
  el.legend.appendChild(usRow);
  const enemyRow = document.createElement('div');
  enemyRow.className = 'legend-row';
  enemyRow.innerHTML = `<span class="legend-swatch" style="background:#c8323c;border-radius:50%"></span> Enemy spawn`;
  el.legend.appendChild(enemyRow);
}

function renderValidation() {
  el.validationList.innerHTML = '';
  if (!state) {
    const li = document.createElement('li');
    li.textContent = 'Nothing loaded yet.';
    el.validationList.appendChild(li);
    return;
  }
  const messages = validateState(state);
  if (messages.length === 0) {
    const li = document.createElement('li');
    li.className = 'ok';
    li.textContent = 'No issues found.';
    el.validationList.appendChild(li);
    return;
  }
  for (const msg of messages) {
    const li = document.createElement('li');
    li.className = 'warn';
    li.textContent = msg;
    el.validationList.appendChild(li);
  }
}

// ---------------------------------------------------------------------------
// Layer tabs
// ---------------------------------------------------------------------------

el.layerTabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.layer-tab');
  if (!btn) return;
  activeLayer = btn.dataset.layer;
  for (const tab of el.layerTabs.querySelectorAll('.layer-tab')) {
    tab.classList.toggle('active', tab === btn);
  }
  renderToolPalette();
});

// ---------------------------------------------------------------------------
// Load / save
// ---------------------------------------------------------------------------

function syncResizeInputs() {
  el.gridWidthInput.value = String(gridW);
  el.gridHeightInput.value = String(gridH);
}

function applyLoadedState(newState) {
  state = newState;
  // A loaded file can be any size (data/battlegrounds.ts's loader no longer enforces a
  // fixed one) — point the editor's canvas at whatever this file's own grid actually is.
  gridW = state.grid[0].length;
  gridH = state.grid.length;
  el.countrySelect.value = state.country;
  fsaFileHandle = null;
  el.btnFsaSave.disabled = true;
  syncResizeInputs();
  buildGridDom();
  renderToolPalette();
  renderGrid();
  renderValidation();
}

async function autoLoad() {
  const country = el.countrySelect.value;
  const path = `../src/data/battlegrounds/${country}.json`;
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json();
    applyLoadedState(loadIntoState(raw, country));
    setStatus(`Loaded ${country}.json from the repo.`, 'ok');
  } catch (err) {
    setStatus(
      `Couldn't auto-load ${country}.json (${err.message}). This works when the folder is served over a local ` +
        `static server; opened as a plain file:// page, browsers block this kind of read. Use "Load JSON file…" ` +
        `instead, or start a blank map.`,
      'error',
    );
  }
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

async function loadFromFile(file) {
  try {
    const text = await readFileAsText(file);
    const raw = JSON.parse(text);
    const country = el.countrySelect.value;
    applyLoadedState(loadIntoState(raw, country));
    setStatus(`Loaded ${file.name} as ${country}.`, 'ok');
  } catch (err) {
    setStatus(`Couldn't load that file: ${err.message}`, 'error');
  }
}

el.btnAutoload.addEventListener('click', () => {
  autoLoad();
});

el.btnOpenFile.addEventListener('click', () => {
  el.fileInput.click();
});

el.fileInput.addEventListener('change', () => {
  const file = el.fileInput.files && el.fileInput.files[0];
  if (file) loadFromFile(file);
  el.fileInput.value = '';
});

el.countrySelect.addEventListener('change', () => {
  if (state) state.country = el.countrySelect.value;
  renderValidation();
});

el.btnBlank.addEventListener('click', () => {
  const country = el.countrySelect.value;
  const w = gridW;
  const h = gridH;
  applyLoadedState(createBlankState(country));
  setStatus(
    `Started a blank ${w}x${h} map for ${country} (bordered walls, open floor, no spawns yet).`,
    'ok',
  );
});

// ---------------------------------------------------------------------------
// Resize (change GRID_W/GRID_H) — crops/pads the current map from the bottom-right;
// content in the overlapping top-left region is kept as-is. User request: "I also want to
// edit the GRID_W and GRID_H."
// ---------------------------------------------------------------------------

function resizeState(newW, newH) {
  const oldW = gridW;
  const oldH = gridH;
  gridW = newW;
  gridH = newH;
  syncResizeInputs();

  if (!state) {
    buildGridDom();
    renderGrid();
    renderValidation();
    setStatus(`Canvas set to ${newW}x${newH} — "New blank map" will use this size.`, 'ok');
    return;
  }

  const oldGrid = state.grid;
  const oldTerrain = state.terrain;
  const newGrid = [];
  const newTerrain = [];
  for (let y = 0; y < newH; y++) {
    const gridRow = [];
    const terrainRow = [];
    for (let x = 0; x < newW; x++) {
      if (x < oldW && y < oldH) {
        gridRow.push(oldGrid[y][x]);
        terrainRow.push(oldTerrain[y][x]);
      } else {
        gridRow.push('wall');
        terrainRow.push('grass');
      }
    }
    newGrid.push(gridRow);
    newTerrain.push(terrainRow);
  }
  // New cells outside the old bounds get 'wall'/'grass' as placeholder defaults above.
  // Once terrain governs walkability, that placeholder grid value would be stale/wrong
  // (grass is walkable) the instant it's painted, so re-derive the whole grid from
  // terrain here rather than leaving mismatched cells around after a resize.
  state.grid = state.terrainEnabled ? deriveGridFromTerrain(newTerrain) : newGrid;
  state.terrain = newTerrain;

  const inBounds = (p) => p.x < newW && p.y < newH;
  const droppedUs = state.usSpawns.filter((p) => !inBounds(p)).length;
  const droppedEnemy = state.enemySpawns.filter((p) => !inBounds(p)).length;
  const droppedProps = state.props.filter((p) => !inBounds(p.pos)).length;
  state.usSpawns = state.usSpawns.filter(inBounds);
  state.enemySpawns = state.enemySpawns.filter(inBounds);
  state.props = state.props.filter((p) => inBounds(p.pos));

  buildGridDom();
  renderGrid();
  renderValidation();

  const dropped = droppedUs + droppedEnemy + droppedProps;
  if (dropped > 0) {
    setStatus(
      `Resized ${state.country} to ${newW}x${newH}. ${dropped} item(s) fell outside the new ` +
        `bounds and were removed (${droppedUs} US spawn(s), ${droppedEnemy} enemy spawn(s), ` +
        `${droppedProps} prop(s)).`,
      'error',
    );
  } else if (newW !== oldW || newH !== oldH) {
    setStatus(
      state.terrainEnabled
        ? `Resized ${state.country} to ${newW}x${newH}. New cells default to grass (walkable) — paint them as needed.`
        : `Resized ${state.country} to ${newW}x${newH}. New cells default to "wall" — paint them as needed.`,
      'ok',
    );
  } else {
    setStatus(`${state.country} is already ${newW}x${newH}.`);
  }
}

el.btnResize.addEventListener('click', () => {
  const w = Math.round(Number(el.gridWidthInput.value));
  const h = Math.round(Number(el.gridHeightInput.value));
  if (
    !Number.isFinite(w) ||
    !Number.isFinite(h) ||
    w < GRID_MIN ||
    w > GRID_MAX ||
    h < GRID_MIN ||
    h > GRID_MAX
  ) {
    setStatus(
      `Width and height must be whole numbers between ${GRID_MIN} and ${GRID_MAX}.`,
      'error',
    );
    return;
  }
  resizeState(w, h);
});

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

el.btnDownload.addEventListener('click', () => {
  if (!state) {
    setStatus('Nothing to export yet — load a country or start a blank map first.', 'error');
    return;
  }
  const text = serializeState(state);
  downloadText(`${state.country}.json`, text);
  setStatus(
    `Downloaded ${state.country}.json — move it into src/data/battlegrounds/ to replace the original.`,
    'ok',
  );
});

el.btnCopy.addEventListener('click', async () => {
  if (!state) {
    setStatus('Nothing to copy yet — load a country or start a blank map first.', 'error');
    return;
  }
  const text = serializeState(state);
  try {
    await navigator.clipboard.writeText(text);
    setStatus('Copied the current JSON to your clipboard.', 'ok');
  } catch (err) {
    setStatus(`Couldn't copy to clipboard (${err.message}) — use Download instead.`, 'error');
  }
});

// --- File System Access API (Chrome/Edge only, best-effort progressive enhancement) ---
// Lets a supported browser open a file, edit it, and save straight back to the same
// path with no manual "download, then move the file" step. Feature-detected: on any
// other browser (or if the call itself is refused, which some browsers do from a
// file:// page) these buttons stay hidden/disabled and Download/Load-file above are
// the primary, always-available path.

const hasFsa = 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
if (hasFsa) {
  el.btnFsaOpen.hidden = false;
  el.btnFsaSave.hidden = false;
}

el.btnFsaOpen.addEventListener('click', async () => {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Battleground JSON', accept: { 'application/json': ['.json'] } }],
    });
    const file = await handle.getFile();
    const text = await file.text();
    const raw = JSON.parse(text);
    const guessedCountry =
      COUNTRIES.find((c) => file.name === `${c}.json`) || el.countrySelect.value;
    applyLoadedState(loadIntoState(raw, guessedCountry));
    fsaFileHandle = handle;
    el.btnFsaSave.disabled = false;
    setStatus(`Opened ${file.name}. "Save to file" will now write straight back to it.`, 'ok');
  } catch (err) {
    if (err.name !== 'AbortError') {
      setStatus(
        `Couldn't open a file this way in this browser (${err.message}). Use "Load JSON file…" instead.`,
        'error',
      );
    }
  }
});

el.btnFsaSave.addEventListener('click', async () => {
  if (!state) return;
  try {
    let handle = fsaFileHandle;
    if (!handle) {
      handle = await window.showSaveFilePicker({
        suggestedName: `${state.country}.json`,
        types: [{ description: 'Battleground JSON', accept: { 'application/json': ['.json'] } }],
      });
      fsaFileHandle = handle;
    }
    const writable = await handle.createWritable();
    await writable.write(serializeState(state));
    await writable.close();
    setStatus(`Saved to ${handle.name}.`, 'ok');
  } catch (err) {
    if (err.name !== 'AbortError') {
      setStatus(`Couldn't save this way (${err.message}). Use "Download JSON" instead.`, 'error');
    }
  }
});

// ---------------------------------------------------------------------------
// Zoom (cell size) — unlike the old flat grid, cellSize is real geometry:
// it's the same unit as the game's ISO_TILE_WIDTH and feeds every isometric
// projection function (projectIso, isoGridBounds, buildCubeFaces, ...). So
// changing it can't just tweak a CSS custom property in place — it has to
// fully rebuild the grid DOM (new bounds, new per-cell positions/sizes).
// `cellSize` itself is declared up in "App state", ahead of buildGridDom()'s
// first call, since the projection helpers above read it.
// ---------------------------------------------------------------------------

function setCellSize(px) {
  const clamped = Math.min(CELL_SIZE_MAX, Math.max(CELL_SIZE_MIN, px));
  cellSize = clamped;
  el.zoomSlider.value = String(clamped);
  el.zoomLabel.textContent = `${clamped}px`;
  if (state) {
    buildGridDom();
    renderGrid();
  }
  return clamped;
}

el.btnZoomOut.addEventListener('click', () => {
  setCellSize(cellSize - CELL_SIZE_STEP);
});
el.btnZoomIn.addEventListener('click', () => {
  setCellSize(cellSize + CELL_SIZE_STEP);
});
el.btnZoomReset.addEventListener('click', () => {
  setCellSize(CELL_SIZE_DEFAULT);
});
el.zoomSlider.addEventListener('input', () => {
  setCellSize(Number(el.zoomSlider.value));
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

document.addEventListener('pointerup', () => {
  painting = false;
  paintAction = null;
});

syncResizeInputs();
setCellSize(CELL_SIZE_DEFAULT);
buildGridDom();
renderLegend();
renderToolPalette();
renderGrid();
renderValidation();
setStatus(
  'Nothing loaded yet. Try "Load from repo" (works when this folder is served locally), or "Load JSON file…" to browse to a file by hand.',
);
