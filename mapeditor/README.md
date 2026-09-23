# Battleground Map Editor

A small, standalone visual editor for `src/data/battlegrounds/<country>.json` — the
hand-editable tactical-battle map files described in that folder's own
[README](../src/data/battlegrounds/README.md). This tool lives outside the game's own
build on purpose: plain HTML/CSS/JS, no npm install, no bundler, no dev server required.

## Opening it

Just open `mapeditor/index.html` in a browser (double-click it, or drag it into a browser
window). Everything works from a `file://` page except the "Load from repo" auto-load
button (see below).

If you'd rather serve it locally (this also unlocks "Load from repo"), any static file
server works from the repo root, for example:

```
npx serve .
# or
python3 -m http.server 8000
```

then open `http://localhost:.../mapeditor/`.

## Loading a map

- **Load from repo** — fetches `src/data/battlegrounds/<country>.json` for whichever
  country is selected in the dropdown. Only works when this folder is served over
  `http://`/`https://` (browsers block this kind of file read from a plain `file://`
  page) — if it fails, use one of the options below instead.
- **Load JSON file…** — browse to any `.json` file on your computer (for example,
  `src/data/battlegrounds/canada.json`) and load it directly. Always works, everywhere.
- **Open… (Chrome/Edge)** — only shown in browsers that support the File System Access
  API. Opens a file the same way, but remembers the file handle so **Save to file**
  (below) can write straight back to it later with no manual download-and-move step.
- **New blank map** — starts a fresh map for the selected country at the current
  Width/Height (20×14 by default): a solid wall border, open floor everywhere else, no
  terrain, no props, no spawns.

Loading any file sets the Width/Height fields (see "Resizing the grid" below) to that
file's own actual size — there's no fixed 20×14 anymore, see
[the schema README](../src/data/battlegrounds/README.md).

## Resizing the grid

The Width/Height fields plus **Resize map** button (top of the page) let you change the
map's actual dimensions — this is what `GRID_W`/`GRID_H` used to be a fixed constant for
(user request: _"I also want to edit the GRID_W and GRID_H"_). Type a new width and/or
height (3–60) and click **Resize map**:

- Existing content in the overlapping top-left region is kept as-is.
- Growing the map fills the new area with `grass` (terrain) — since grass is walkable,
  that means new cells are `floor` on the grid too when the terrain layer is enabled (see
  "Editing" below), or plain `wall` when it isn't. Either way, paint it in like any other
  cell.
- Shrinking the map drops anything that falls outside the new bounds (spawns, props) and
  tells you how many; check the validation panel afterward in case that dropped too many
  spawn points for the roster.
- With nothing loaded yet, resizing just sets the size **New blank map** will use next.

The exported file's `"grid"`/`"terrain"` are simply however many rows/columns you resized
to — `src/data/battlegrounds.ts`'s loader reads a file's actual size back off its own grid,
it doesn't require any particular size.

## Zooming

The Zoom slider (and −/+/Reset buttons) above the grid change the actual on-screen tile
size (16–64px, default 32px — the same px value as the real game's `ISO_TILE_WIDTH`)
without changing the map's actual dimensions. Because the grid is isometric (see below),
zoom isn't a free CSS scale here: every tile's projected screen position depends on tile
size, so changing it rebuilds the whole grid.

## Editing

The grid renders isometrically — the same 2:1 dimetric projection as the real battle
camera (`src/ui/room/isometric.ts`), not a flat top-down view (real user feedback: _"I
cannot pan to the map's corner. Maybe the map editor should be isometric too."_). A flat
grid made it easy to place a spawn or wall two rows away from where it actually reads as
"close" once the real camera projects it; this way what you see while editing is what
you'll see in-game. A `wall` cell renders as a real 3-face extruded block (same as the
game) if it has no terrain painted, or a `BLOCK_TERRAIN` kind (`cliff`, or one of the
three waterfall kinds); any other terrain (water, grass, a shoreline texture, etc.)
renders it as a flat, impassable, textured diamond instead — exactly the game's own
render rule.

Panning is plain native browser scrolling (scrollbars, trackpad, mouse wheel, or — once
you click the map to focus it — arrow keys/Page Up/Down/Home/End), not a custom camera. A
wall block's click target is its whole bounding rectangle rather than a pixel-perfect
clip to its 3 faces — a deliberate simplification for a hand-editing tool; zoom in if two
adjacent walls' rectangles ever get hard to tell apart.

Pick a layer on the left, pick a tool, then click or click-and-drag across the grid:

- **Grid** — paint `floor` / `wall` / `object` / `door`. This is the layer that affects
  actual gameplay (movement and attack range) — **but only for a country with the terrain
  layer disabled.** Once terrain is enabled (see below), walkability is _derived_ from
  terrain automatically and this layer becomes read-only (its swatches disappear; the
  panel explains why). This mirrors the real game's loader exactly: whenever a
  battleground has a terrain grid at all, its `grid` is computed from terrain, never
  hand-typed independently (real user feedback: _"The terrain map should be based on the
  selected background tile. You can walk on grass, rocky ground and stonePath."_).
- **Terrain** — tick "Enable terrain layer" to paint real textures (grass/rocky
  ground/stone path/water/cliff/shore grass/shore rock/three waterfall designs); leave it
  off and the country renders as plain colored tiles and hand-painted `grid` values,
  exactly like before this system existed. The shoreline and waterfall kinds were added
  for a real user request, with 5 supplied reference tile images: _"Are you able import
  those tiles to allow me to generate the river border + waterfall?"_ — the three
  waterfall kinds render as a tall block, same as cliff, since a waterfall is a vertical
  drop, not a flat patch (their block top face reuses the plain `water` texture; only
  their side faces use each waterfall's own art).
  **Once enabled, every terrain paint also recomputes that cell's `grid` value**: grass,
  rocky ground, stone path, and shore grass become `floor`; water, cliff, shore rock, and
  all three waterfall kinds become `wall`. Toggling the checkbox back on after painting
  always re-derives the _entire_ grid from the current terrain, discarding any stale
  hand-painted grid values. Unticking doesn't erase your painted terrain — it's just
  excluded from the exported file (and grid reverts to hand-paintable) until you
  re-enable it.
- **Props** — click a prop thumbnail (or "Eraser"), then click cells to place/remove
  decorations. **Placing a prop marks that cell `object` on the Grid layer by default**
  (real user feedback: _"The props in map editor should mark the grid as object by
  default"_) — a building/tree/fence blocks movement the moment you place it, no second
  trip to the Grid layer needed. This only happens while terrain is disabled — with
  terrain enabled, `grid` is fully derived from the Terrain layer instead (see above), so
  paint the cell as water/cliff there if you want the prop to actually stop units. Erasing
  a prop deliberately leaves the grid cell's value alone (there's no way to tell an
  auto-set `object` apart from a hand-painted wall/object a prop happened to land on), so
  clear it yourself on the Grid layer if you want that spot walkable again.
- **US spawns** / **Enemy spawns** — click a cell to add or remove a starting position
  for that side. The number on each marker is spawn order (spawn 1 goes to the first
  unit, spawn 2 to the second, and so on).

Because walkability now flows one-way from terrain, a country whose terrain has never been
touched up since it was painted may have surprising side effects once terrain governs
grid — for example, a border painted as plain grass is now walkable ground rather than a
wall, and any decorative prop sitting on grass no longer blocks movement. Check the
validation panel (below) and the Terrain layer for anything that needs a texture change
(grass → cliff for a wall, etc.) rather than a grid change.

The right-hand sidebar shows live validation: spawns that aren't on a floor tile, not
enough spawn points for that side's roster, props sitting on a walkable cell, and so on.
These are warnings, not hard blocks — the editor can only ever produce a structurally
valid file (a rectangular grid, valid enum values), so these flag things that are _legal_
but probably not what you meant.

## Saving

- **Download JSON** — downloads the current map as `<country>.json`. Move (or overwrite)
  it into `src/data/battlegrounds/` yourself to replace the original.
- **Save to file** (Chrome/Edge, after using **Open…** above) — writes straight back to
  the file you opened, no manual move needed.
- **Copy JSON** — copies the current map's JSON text to your clipboard.

The exported JSON matches this repo's actual Prettier formatting exactly (arrays fully
expanded one item per line, small `{x, y}`/prop objects collapsed onto one line) — no
reformatting pass needed, and it'll produce a clean git diff against the original file.

## Keeping this tool in sync with the game

This editor is a deliberately independent, hand-written port of
`src/data/battlegrounds.ts`'s own validation rules (`parseGrid`/`parsePositions`/
`parseProps`) — not a shared import, since the whole point is that it has no build step
and no dependency on the game's own TypeScript/Vite toolchain. If that file's schema ever
changes (a new `TileKind`/`TerrainKind`, a new top-level key), this tool's `editor.js`
needs the matching update by hand. The same goes for `ROSTER_SIZES` (mirrors
`data/battleRosters.ts`'s roster lengths, used only for the soft "not enough spawn
points" warning) and the `PROP_FILES`/terrain filename lists (mirror
`public/assets/battle-tiles/`'s actual contents).
