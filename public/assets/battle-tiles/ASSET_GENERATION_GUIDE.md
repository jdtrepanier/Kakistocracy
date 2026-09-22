# Generating new battle-tile art

A style/spec guide for generating more assets that actually match the game's isometric
camera and this folder's existing art — written after processing the "sheet 2" batch the
user supplied (2026-09), which became this folder's newest props (see
`src/data/battlegrounds/README.md`'s props list and this project's `CLAUDE.md` changelog
for exactly which files came from that batch). Use this as a prompt/spec any time you
(person or AI) are generating more `terrain/` or `props/` art for
`src/data/battlegrounds/*.json` battlegrounds.

## The camera angle you must match

The game's isometric camera (`src/ui/room/isometric.ts`, shared by the room view and the
battle view) is a fixed **2:1 dimetric projection**, not a "true" 30° isometric and not a
flat top-down view:

```
screenX = (gridX - gridY) * (TILE_WIDTH / 2)
screenY = (gridX + gridY) * (TILE_HEIGHT / 2)
TILE_WIDTH  = 32   // px, at 1x zoom
TILE_HEIGHT = 16   // px, at 1x zoom  →  exactly half the width
```

The practical consequence for art: **a floor tile's top face reads as a diamond exactly
twice as wide as it is tall.** If a generated tile's diamond footprint is noticeably
steeper (taller/narrower, closer to a "true" 30° isometric) or flatter (shallower, closer
to top-down), it will look visibly crooked sitting next to every other tile on the grid —
this is the single most important thing to get right, and the easiest thing for an image
generator to get subtly wrong without being told explicitly.

A standing object (wall, cliff block, building, tree) additionally needs its vertical
faces to read as flat parallelograms consistent with that same 2:1 skew — not vertical
rectangles (that's a true-isometric or orthographic look) and not curved/perspective
(that's a camera-with-vanishing-points look). `ISO_WALL_HEIGHT = 22` / `ISO_OBJECT_HEIGHT
= 14` (both in the same px units as the 32×16 tile footprint) are how tall the *current*
CSS-extruded wall/object blocks stand — useful as a rough proportion reference (a wall
block is roughly 1.4 tile-widths tall) even though a whole pre-rendered block image (see
"Two different techniques" below) isn't held to that exact number.

## Suggested prompt template

```
Isometric game tile, [SUBJECT], 2:1 dimetric isometric camera angle (the tile's top
face/footprint reads as a diamond exactly twice as wide as it is tall — not a steep 30°
isometric, not top-down), semi-realistic painterly rendering, soft directional lighting
from the upper-left, soft ambient-occlusion contact shadow where the object meets the
ground, natural saturated colors, crisp clean edges, single object centered in frame,
isolated on a fully transparent background with nothing else in frame (no ground plane,
no background color, no vignette, no drop shadow cast onto empty space beyond the
object's own base), high detail, game asset, no text or watermark, no multiple
angles/variations in one image
```

Swap `[SUBJECT]` for whatever you need (see the checklist below for exact names/shapes to
ask for). Keep the isometric-angle sentence close to verbatim — it's the part generators
drift on first.

## Transparent background — avoid the "colored fringe" problem

Every image in the "sheet 2" batch had a faint colored halo (red/blue/green/yellow, 1–2
out of 255 alpha) baked around its edges — essentially invisible at normal size but
visible once zoomed in or composited over a dark background. This is a background-removal
artifact: the source almost certainly had a colored ground plane or backdrop that an
auto-matting step didn't fully strip, leaving a near-transparent tint of that background
color bleeding through the object's anti-aliased edge.

Two ways to avoid it in a future batch:

1. **Best**: generate (or request) the image already isolated on a transparent
   background, with no ground plane or backdrop at all — nothing to imperfectly remove
   later.
2. **If that's not possible**: after matting, hard-zero any pixel with alpha below ~8
   (out of 255) rather than trusting the matting tool's own edge — that's exactly the
   cleanup this session did to the sheet 2 batch (see the `extract` step in this project's
   `CLAUDE.md` changelog for the exact threshold and method, a plain NumPy pass: any pixel
   under that threshold gets its alpha *and* RGB zeroed, then the crop is tightened to the
   cleaned alpha channel — not just cropped to a loose bounding box that still contains the
   faint fringe).

## Two different techniques — pick one before generating cliff/wall art specifically

This matters only for **wall-height terrain** (currently just `cliff`) and any future
wall-like prop — floor tiles and small props don't have this fork.

- **Current engine technique** (`data/battlegrounds.ts` + `ui/room/isometric.ts`'s
  `buildCubeFaces`): a wall/cliff tile is built from a **single flat texture**
  (`cliff-face.png` for the two visible side faces, `cliff-top.png` for the flat top),
  extruded into a 3D-looking block at render time via three CSS `clip-path` polygons (top
  diamond, left parallelogram, right parallelogram), with the side faces additionally
  darkened by a CSS `filter` for shading. To generate art for this technique: **two
  separate flat images** — a top-down diamond-ish crop (`cliff-top.png`, no 3D shading of
  its own, the CSS extrusion adds shading) and a flat rectangular side-face crop
  (`cliff-face.png`). Same 256×256 canvas as the existing terrain textures is a safe
  target size.
- **Whole pre-rendered block technique** (what the "sheet 2" cliff/waterfall images
  already are — a fully-shaded 3D cube baked into one image, all faces already
  composited with their own lighting): this needs a different rendering path — stamping
  the whole image at the tile's position instead of extruding CSS faces from a flat
  texture. Much better visual fidelity (real baked ambient occlusion, natural rock
  silhouettes instead of a mechanically-repeated flat texture), but it's a real rendering
  change, not just a file swap, and it wasn't wired in as part of this pass — check
  `CLAUDE.md`'s changelog for whether/how that landed before generating more art assuming
  this technique. If generating for this technique, the block's height-to-footprint
  proportion should stay visually consistent across variants (so a cliff row reads as one
  continuous height, not a jagged skyline) — there's no single fixed pixel target the way
  the flat-texture technique has, since nothing in the engine currently measures or scales
  these images against the tile grid; that calibration is itself part of the still-pending
  rendering work.

## Canvas size

No hard requirement — every image in this folder gets scaled by CSS at render time
(`object-fit: contain` for props in a ~34×54px box; `background-size: cover`/`contain` for
terrain). Generate comfortably large (512×512 or bigger for a full scene, tighter crops
fine for small props) so downscaling stays crisp, then let the matting/crop step (above)
tighten it to actual content. Existing flat terrain textures are 256×256; existing small
props are wherever they naturally cropped to (no fixed prop canvas size).

## Naming convention

kebab-case, `<category>-<descriptor>.png`, lowercase, hyphens only (this is also a hard
engine requirement — `data/battlegrounds.ts` validates prop paths against
`^/assets/battle-tiles/props/[a-z0-9-]+\.png$`). Match the existing naming pattern
(`tree-round-a.png`, `building-brick.png`, `fence-wood-rail.png`) rather than inventing a
new convention — see the full current list in `src/data/battlegrounds/README.md`'s props
section.

## Checklist — what's still missing as of this batch

**Flat floor terrain (highest priority — none of these were in the sheet 2 batch at
all):**

- `grass` — flat top-down turf diamond (replaces `terrain/grass.png`)
- `rockyGround` — flat cracked/rocky dirt diamond (replaces `terrain/rocky-ground.png`) —
  note this one has **no reference example in either sheet supplied so far**, so there's
  nothing to match stylistically except the prompt template above
- `stonePath` — flat paved plaza/bridge diamond (replaces `terrain/stone-path.png`)
- `water` — flat river surface diamond (replaces `terrain/water.png`)

**Wall/cliff terrain — generate only once the rendering-technique question above is
settled**, since the two techniques need different source art (a flat top+face pair, vs.
a whole pre-rendered block per variant).

**Anything else**: more standing props (additional building/vehicle/scenery variety) are
always fine to add the same way this batch was — new files, additive, never required to
replace what's already there unless you're deliberately retiring an old one.
