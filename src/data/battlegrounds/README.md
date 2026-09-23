# Battleground JSON files

Every country has a file here (`canada.json`, `greenland.json`, `panama.json`,
`mexico.json`, `iran.json`, `venezuela.json`, `russia.json`) — a hand-editable description
of that country's tactical battle map: `src/data/battlegrounds.ts` loads it, checks its
shape, and turns it into what `ui/battle/BattleView.tsx` actually draws. You can edit these
files directly with any text editor — no code changes needed — and the game will pick up
your changes the next time it (re)loads. If you make a mistake (a typo, a missing row, a
spawn point off the edge of the map), the game will throw a clear error naming exactly
which row/column/entry, **and which country's file**, is wrong, rather than silently
drawing something broken.

**Prefer not to hand-edit JSON?** `mapeditor/` at the repo root (a sibling of `src/`) is a
small standalone visual editor for these exact files — open `mapeditor/index.html` in a
browser, pick a country, click tiles to paint the grid/terrain, place props, and click to
set each side's spawn points, then export the result over the file in this folder. See
`mapeditor/README.md`.

Only `canada.json` has custom `"terrain"`/`"props"` today — the other six were generated as
a straight, lossless copy of the plain shared battlefield every country used to fight on
(so nothing about how those battles look or play changed by getting their own file), and
have no `"terrain"`/`"props"` key at all yet (both are optional — see "Top-level keys"
below). Painting one in is exactly what the map editor above is for.

## Grid size is per-file — every file today happens to be 20 columns × 14 rows

Each file defines its own size: `"grid"` just has to be **rectangular** (every row the same
length as row 0) — there's no fixed global width/height anymore. `data/battlegrounds.ts`'s
loader reads a file's actual size straight off its own `"grid"` (row count = height, row 0's
length = width) and validates everything else — `"terrain"` (must be that exact same size),
`"usSpawns"`/`"enemySpawns"`/`"props"` positions (must land inside that size) — against it.
User request: _"I also want to edit the GRID_W and GRID_H"_ — previously every file had to be
exactly `data/battlefield.ts`'s `BATTLEFIELD_WIDTH`×`BATTLEFIELD_HEIGHT` (20×14) or the loader
threw, so making one country's battlefield bigger or smaller meant changing that shared
constant for every country at once. All seven files still happen to be 20×14 today (nothing
has actually resized one yet), but that's no longer enforced — `mapeditor/`'s width/height
resize control (see its own README) is the easiest way to actually produce a differently-sized
file.

Coordinates: `x` is the column (0 = left edge, `width - 1` = right edge), `y` is the row
(0 = top edge, `height - 1` = bottom edge — 19/13 for every file today). Every file ships
with the outer edge (`x=0`, `x=width-1`, `y=0`, `y=height-1`) as a solid wall border, but
nothing forces that — see "Gotchas" below before editing an edge cell.

## Top-level keys

### `"grid"` — the walkable layout

An array of rows (14 rows in every file today, but any number works); each row is an array
of the same length as row 0 (20 cells in every file today), one of:

| Value      | Meaning                                                                          |
| ---------- | -------------------------------------------------------------------------------- |
| `"floor"`  | Walkable — units can stand here and path through it.                             |
| `"wall"`   | Not walkable — a border, a rock, a river cell, or anything a prop sits on.       |
| `"object"` | Not walkable (reserved for future use — not currently used by any battleground). |
| `"door"`   | Not walkable (reserved for future use — not currently used by any battleground). |

This is what the actual battle simulation uses for movement and line of... actually, range
(every unit in this game only attacks at melee range — there's no line-of-sight check, only
distance). **This is the one part of the file that affects gameplay balance, not just
looks** — see "The diagonal river, and why it's not a straight column" below before turning
a big chunk of the map into `"wall"`.

**For any file that also has a `"terrain"` key, `"grid"` is not the source of truth —
it's derived.** See "`terrain`" just below. `"grid"` still has to be present and
well-formed (the loader still uses it to establish the file's width/height and to catch
malformed values), but its actual walkability values are overridden at load time by
`gridFromTerrain(terrain)` whenever `"terrain"` exists in the file. Only the six files with
no `"terrain"` key at all still use `"grid"`'s hand-typed values directly.

### `"terrain"` — what texture paints each cell, \*\*and, once present, the only source of

walkability\*\*

Exactly the same shape as `"grid"` (same row count, same row length) — the loader rejects a
`"terrain"` that's a different size than `"grid"` in the same file. One of:

| Value                | Texture                      | Renders as                 | Walkable? |
| -------------------- | ---------------------------- | -------------------------- | --------- |
| `"grass"`            | Green turf                   | Flat                       | Yes       |
| `"rockyGround"`      | Cracked dirt                 | Flat                       | Yes       |
| `"stonePath"`        | Paved plaza/bridge           | Flat                       | Yes       |
| `"water"`            | River                        | Flat                       | No        |
| `"shoreGrass"`       | Grass meeting water          | Flat                       | Yes       |
| `"shoreRock"`        | Rocky boulders meeting water | Flat                       | No        |
| `"cliff"`            | Rock face                    | **Tall extruded 3D block** | No        |
| `"waterfallColumns"` | Two-pillar waterfall         | **Tall extruded 3D block** | No        |
| `"waterfallWide"`    | Wide waterfall               | **Tall extruded 3D block** | No        |
| `"waterfallTall"`    | Tall/narrow waterfall        | **Tall extruded 3D block** | No        |

`"cliff"` and the three `"waterfall*"` kinds are the only terrain that stands up off the
field as a real 3D block (`BLOCK_TERRAIN` in `data/battlegrounds.ts`) — every other kind,
including the two shoreline kinds, renders as a flat textured diamond. The `shoreGrass`/
`shoreRock`/`waterfallColumns`/`waterfallWide`/`waterfallTall` kinds were added for a real
user request, with 5 supplied reference tile images: _"Are you able import those tiles to
allow me to generate the river border + waterfall?"_ A waterfall's block top face reuses
the plain `water.png` texture (the flowing river surface at the head of the falls) — only
its side faces use the waterfall's own art.

User request: _"The terrain map should be based on the selected background tile. You can
walk on grass, rocky ground and stonePath."_ As of that change, **`"terrain"` is no longer
purely visual.** Whenever a file has a `"terrain"` key at all, `data/battlegrounds.ts`'s
loader computes that file's actual `"grid"` from `"terrain"` alone, cell by cell, via
`gridFromTerrain`/`WALKABLE_TERRAIN` — `grass`/`rockyGround`/`stonePath` always become
`"floor"`, `water`/`cliff` always become `"wall"`, and whatever was hand-typed in the raw
`"grid"` field for that file is discarded in favor of this derived value (the raw value is
still parsed and validated for shape, just not used for its cell contents). This makes it
structurally impossible for a file's `"grid"` and `"terrain"` to drift out of sync the way
they previously could (a real earlier bug: a spawn or unit could stand on a tile the loader
called `"floor"` that was textured as a river). A file with no `"terrain"` key at all
(every non-Canada file today) is completely unaffected — its `"grid"` stays the sole,
hand-typed source of walkability, exactly as before this change.

If you're hand-editing a file with a `"terrain"` key directly in a text editor rather than
through `mapeditor/`, remember that any `"grid"` value you type by hand for that file will
be silently overridden by the loader based on `"terrain"` — edit `"terrain"` to change
walkability there, not `"grid"`.

Texture image files live in `public/assets/battle-tiles/terrain/`: `grass.png`,
`rocky-ground.png`, `stone-path.png`, `water.png`, `shore-grass.png`, `shore-rock.png`,
`cliff-face.png` (the cliff block's side), `cliff-top.png` (the cliff block's flat top),
`waterfall-columns.png`, `waterfall-wide.png`, `waterfall-tall.png` (each waterfall
block's own side art — their block top face reuses `water.png`, no separate file).

### `"props"` — decorations (trees, buildings, fences...)

An array of `{ "pos": { "x": ..., "y": ... }, "image": "..." }`. `"image"` must be a path
under `/assets/battle-tiles/props/` (exact filename, forward slashes) — the full list
currently available in `public/assets/battle-tiles/props/`:

```
barrier-checkpoint.png      boat-patrol.png
bridge-steel-stone.png      building-brick-plain.png
building-brick-shop.png     flag-canada.png
flag-us.png                 forest-pine-cluster.png
forest-round-cluster.png    gate-iron.png
jeep.png                    rock-pile.png
sandbags-crates.png         tent-canvas.png
tent-medic.png              watchtower.png
```

(This is the full 16-file prop batch extracted from the user-supplied "sheet 2" AI tile
sheet in 2026-09 — see `CLAUDE.md`'s changelog for that round. The original 29
placeholder-era props this project started with have been removed; every Canada placement
that used one was first remapped to the nearest equivalent from this batch — see that same
changelog entry for the exact old→new mapping and the one known compromise it involved
(several distinct individual-tree images collapsed onto the two forest-cluster images
above, since this batch has no individual-tree variants).

Generating more art for this folder (terrain or props)? See
`public/assets/battle-tiles/ASSET_GENERATION_GUIDE.md` for the exact isometric camera
angle to match, a prompt template, and a checklist of what's still missing.

A prop is purely decorative — it never blocks movement on its own, as far as this JSON
schema itself is concerned. If you add a prop to a cell that's `"floor"` in `"grid"`,
units will be able to walk right through it, which will look wrong — for a file with no
`"terrain"` key, set that cell to `"wall"` (or `"object"`) too if you want the prop to
actually block the tile; for a file with `"terrain"` (where `"grid"` is derived, see
above), paint that cell as `"water"` or `"cliff"` on the terrain layer instead. (The map
editor's Props tool now does this for you automatically — placing a prop there marks the
cell `"object"` by default while terrain is disabled, real user feedback: _"The props in
map editor should mark the grid as object by default"_ — but a prop added by hand in this
raw JSON still needs its own `"grid"`/`"terrain"` value set explicitly, same as always.)
This key is also optional (only `canada.json` has any today). Not every
prop in `canada.json` currently sits on a non-walkable cell — several decorative props
(trees, a fence) were originally hand-placed on grass expecting `"grid"` to independently
say `"wall"` there, and now that `"grid"` is terrain-derived, grass is walkable, so those
specific props no longer block movement. That's a real, known side effect of switching
Canada's walkability source to terrain, not a bug in the derivation rule — touch up the
terrain under a prop (or accept it as purely decorative) if that's not the intended look.

### `"usSpawns"` / `"enemySpawns"` — where each side's units start

Arrays of `{ "x": ..., "y": ... }`. These are the starting tile positions the moment a
battle begins — this is "the starting player positions" the JSON file exists to make
editable, for every country now, not just Canada. Rules:

- Every position must land on a `"floor"` cell in `"grid"` — a unit can't spawn inside a
  wall.
- You need at least as many spawn points as units on that side: the US side always fields
  6 (every switchable official fights together). The enemy side needs at least as many as
  that country's roster in `data/battleRosters.ts` — Canada's is the largest at 7,
  Greenland's and Iran's are 5, Panama/Mexico/Venezuela/Russia are 3 each. Fewer spawn
  points than units means some units simply won't appear. Extra unused spawn points beyond
  what a roster needs are harmless — they're just never assigned to anyone.
- Positions don't need to be adjacent to each other or in any particular order.

## The diagonal river, and why it's not a straight column

This section describes `canada.json` specifically (the only file with a river today), but
the underlying rule applies to any country's file the moment you draw a diagonal feature
of your own — worth reading before you add water/stonePath cells to any country.

The game's isometric camera (`ui/room/isometric.ts`) places a cell on screen using
`screenX = (x - y) * 16`. **Screen-horizontal position depends only on `x - y`, never on
`x` or `y` by itself.** That means a straight column of constant `x` — which looks like a
clean vertical line in the JSON grid — actually renders as a _diagonal_ line sweeping
across the screen as `y` changes, not a vertical one. (This bit us for real: an earlier
version of this file split the US/Canada banks on a plain column, and it rendered as two
disconnected diagonal river slivers in opposite corners instead of one crossing.)

So in `canada.json`, the river/bridge is every cell where `x - y` is between 1 and 4
(inclusive) — a diagonal band, not a column — which is what actually renders as one
consistent vertical band on screen. If you want to move the river, widen it, or add a
second one, pick cells the same way: by a constant (or narrow range of) `x - y`, not by a
constant `x`. The US camp sits where `x - y` is well below that band (roughly -7 to -1, matching
`"usSpawns"`), and the Canadian camp sits well above it (roughly 7 to 13, matching
`"enemySpawns"`).

The river only actually blocks movement in rows 1-3 and 10-12 — rows 4-9 (the "engagement
band," where every spawn point sits) are left as open `"floor"`/`"stonePath"` on purpose.
Every unit in this game only attacks at melee range (checked in `data/battleRosters.ts`),
so a real chokepoint through the rows where combat actually happens doesn't just slow
things down — it caps how many units can ever fight at once, which was a real, measured
balance regression the first time this map was built (US win rate crashed from ~43% to
9.8% in a 2000-battle simulation). If you narrow the open rows back down, re-run
`scripts/simulateBattle.ts` before shipping it — `scripts/simulateBattle.test.ts` has a
`0.2 < rate < 0.7` guard on Canada specifically for this reason.

## Gotchas

- **Nothing in code forces the outer edge to be a wall anymore** — for a file with no
  `"terrain"` key, the loader (`battlegrounds.ts`) just uses whatever you put in `"grid"`
  for every cell, edge included; for a file with `"terrain"`, it's whatever texture you
  painted on the edge (see "`terrain`" above) that decides it. Every file ships with a
  solid wall/cliff border because that's what looks right, not because it's required — if
  you set an edge cell (`x=0`, `x=width-1`, `y=0`, or `y=height-1`) to `"floor"` (or, for a
  terrain file, to a walkable texture like `"grass"`), units really will be able to walk
  onto it. `canada.json`'s own border happens to be textured as plain grass today, so it is
  in fact fully walkable — see the props section above for the related caveat about props
  that were placed expecting the old, grid-independent walkability rule.
- **Resizing a file changes `width`/`height` themselves** — add or remove rows to change
  `height`, add or remove cells from every row (the same number of cells from every row, or
  the loader's rectangular check will throw) to change `width`. `mapeditor/`'s resize
  control does this for you and keeps everything else (props, spawns, terrain) in sync — see
  its README before resizing a file by hand.
- **Every country's file is independent** — editing `iran.json` can never affect Canada's
  or any other country's battle. The six non-Canada files started as identical copies of
  the same shared field, but they're separate data now, not separate views onto one shared
  array; that's the whole point of splitting them out.
- **Row order is top-to-bottom, not bottom-to-top** — `"grid"[0]` is the very top row of
  the map (`y=0`), not the bottom.
- **A cell is `row[column]`, i.e. `grid[y][x]`**, not `grid[x][y]` — easy to get backwards
  when eyeballing a big block of text.
- Every prop's `"image"` value is checked against the exact filenames above — a typo there
  won't crash the game (a missing image just doesn't render), so double-check it by eye if
  a prop seems to be missing.
