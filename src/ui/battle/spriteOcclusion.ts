import type { GridPosition } from '@/engine/movement';
import { isoDepth, projectIso } from '../room/isometric';

/**
 * Pure geometry for detecting when one battle unit's sprite visually covers a teammate
 * standing behind it (real user feedback, screenshot of the spawn formation: a front-row
 * official's tall sprite completely hid the face of a unit standing diagonally behind
 * them — "can we try to detect sprite from our own team that block our view. We could
 * make them semi-transparent while we play"). No React, no DOM — `BattleView.tsx` only
 * reads the resulting id set and adds a CSS class.
 *
 * Why this happens at all: `data/battlefield.ts`'s spawn tiles stack teammates one
 * *tile-height* apart on screen (`ISO_TILE_HEIGHT`, 16px) whenever two spawn points sit
 * on the same isometric diagonal, but `.battle-unit-sprite` (`battle.css`) renders each
 * unit's whole body at 42px tall — well over two tile-heights. The unit nearer the
 * camera (bigger `x + y`, drawn later/on top per `isoDepth`) ends up with its sprite
 * pasted right over the top of the teammate one tile back. It isn't limited to the
 * player's own spawn formation, either — `ENEMY_SPAWN_POSITIONS` has the exact same
 * stacking pattern, so this is checked across every unit on the field, not just one side.
 */

/** Mirrors `.battle-unit-sprite`'s 26×42 box and `.battle-unit-iso`'s
 * `transform: translate(-50%, -78%)` anchor in `battle.css` — kept in sync by hand, same
 * "CSS can't reference a JS constant" situation as this file's sibling `BattleView.tsx`
 * constants (`CAMERA_TRANSITION_MS`, `PAN_STEP`). Only the sprite's own box matters here,
 * not the taller `.battle-unit-iso` wrapper (which also reserves room for the flag badge
 * and turn marker below it) — covering a teammate's flag pastille or turn arrow isn't
 * the complaint, covering their face is. */
const SPRITE_WIDTH = 26;
const SPRITE_HEIGHT = 42;
const TOKEN_HEIGHT = 56;
const TOKEN_ANCHOR_Y = 0.78;

/** Fraction of the back unit's sprite area that must be covered before it counts as
 * "actually blocking the view" rather than a graze at the box edges. At this fraction, a
 * unit stacked exactly one tile-height in front of a teammate on the same screen column
 * (the real spawn-formation case above, ~62% vertical sprite overlap) is caught, while
 * two units in merely adjacent columns (whose boxes typically don't overlap at all, or
 * only by a sliver) are left alone. */
const MIN_OCCLUSION_FRACTION = 0.25;

interface Rect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

function spriteRect(pos: GridPosition): Rect {
  const point = projectIso(pos);
  const top = point.y - TOKEN_HEIGHT * TOKEN_ANCHOR_Y;
  return {
    left: point.x - SPRITE_WIDTH / 2,
    right: point.x + SPRITE_WIDTH / 2,
    top,
    bottom: top + SPRITE_HEIGHT,
  };
}

function overlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

/**
 * True when a unit standing at `frontPos` — nearer the camera, drawn later/on top per
 * `isoDepth` — covers enough of a unit at `backPos` to actually hide its face, not just
 * graze its feet or a sliver at the box edge. Order matters: always call this with the
 * unit that paints on top as `frontPos`.
 */
export function occludes(frontPos: GridPosition, backPos: GridPosition): boolean {
  const area = overlapArea(spriteRect(frontPos), spriteRect(backPos));
  return area / (SPRITE_WIDTH * SPRITE_HEIGHT) >= MIN_OCCLUSION_FRACTION;
}

/**
 * Ids of every unit in `units` whose sprite is currently covering enough of some other
 * unit standing behind it to hide that unit's face. Works over any mix of units on
 * either side — see this file's doc comment for why the enemy roster needs the same
 * check as the player's own. O(n²), fine for a battle-sized roster (well under 20 units
 * on the field at once).
 *
 * Superseded as `BattleView.tsx`'s actual fading source by `unitsOccludingActive` below
 * (user feedback narrowed the feature's scope — see that function's doc comment), but
 * kept and still exported: it's the more general primitive `unitsOccludingActive` is
 * built from, and `spriteOcclusion.test.ts` exercises it directly against real
 * whole-roster spawn data.
 */
export function occludingUnitIds<T extends { readonly id: string; readonly pos: GridPosition }>(
  units: readonly T[],
): ReadonlySet<string> {
  const result = new Set<string>();
  // `units.entries()`/`.slice()` rather than indexed `units[i]`/`units[j]` access — this
  // project's `noUncheckedIndexedAccess` (CLAUDE.md's Conventions) would otherwise type
  // every indexed read as possibly `undefined`, even though the loop bounds make that
  // impossible here.
  for (const [i, a] of units.entries()) {
    for (const b of units.slice(i + 1)) {
      const depthA = isoDepth(a.pos);
      const depthB = isoDepth(b.pos);
      if (depthA === depthB) continue; // same draw order — neither reliably paints over the other
      const [front, back] = depthA > depthB ? [a, b] : [b, a];
      if (occludes(front.pos, back.pos)) result.add(front.id);
    }
  }
  return result;
}

/**
 * Ids of units currently covering enough of `activeId`'s own sprite to hide its face —
 * scoped to just the unit whose turn it currently is (real user feedback narrowing the
 * feature from the whole-roster check above: "The only [units] in front and around the
 * USA current playing player should be semi transparent" — fading some unrelated pair
 * elsewhere on the field, while a real occlusion by the definition above, read as
 * distracting noise once you're actually looking at a specific unit to decide its move).
 * Only ever returns units *other than* `activeId` — pairs the active unit with a
 * teammate it in turn covers are deliberately not surfaced here, since `BattleView.tsx`
 * never fades the active unit itself regardless (see its `isCurrent` handling), so there
 * would be nothing to *do* with that information on this end. Returns an empty set if
 * `activeId` isn't found in `units` (defensive; shouldn't happen in practice).
 */
export function unitsOccludingActive<T extends { readonly id: string; readonly pos: GridPosition }>(
  units: readonly T[],
  activeId: string,
): ReadonlySet<string> {
  const active = units.find((u) => u.id === activeId);
  if (!active) return new Set();
  const activeDepth = isoDepth(active.pos);
  const result = new Set<string>();
  for (const u of units) {
    if (u.id === activeId) continue;
    // Only a unit *nearer the camera* than the active one can paint over it at all
    // (`isoDepth`/painter's-order, same rule `occludingUnitIds` uses above).
    if (isoDepth(u.pos) <= activeDepth) continue;
    if (occludes(u.pos, active.pos)) result.add(u.id);
  }
  return result;
}
