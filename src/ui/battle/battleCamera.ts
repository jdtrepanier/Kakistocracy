import type { IsoPoint } from '../room/isometric';

/**
 * Pure camera math for the battle screen's scrolling map (user feedback: "make the
 * battle much bigger and we could scroll the map like in Shining Force"). The room
 * camera (`ui/room/isometric.ts`'s doc comment, `RoomView.tsx`) already centers on the
 * player with no clamping at all — fine there, since the player can't walk off the
 * room's own floor tiles anyway. A battle camera needs more: it auto-follows whoever's
 * turn it is (`useBattleCamera.ts`), but the player can also pan around a much bigger
 * field by hand on their own turn (arrow keys or a drag, `BattleView.tsx`) to scout
 * ahead — and a hand-panned camera absolutely can scroll past the map's own edges
 * without a clamp. Kept in its own pure, DOM-free file (no React, no `Math.random`) so
 * every case — centering, panning, and the "grid smaller than the viewport" edge case —
 * has a real, executable test, same split as `room/playerDepth.ts` (pure, tested) vs.
 * `RoomView.tsx`'s `usePlayerDepth` (the React glue that calls it).
 */

/** A 2D size in stage px — the projected battle grid's full bounds
 * (`isometric.ts`'s `isoGridBounds`), or the on-screen battle viewport's own size
 * (`ui/room/useElementSize.ts`, reused here for the same measurement need `RoomView.tsx`
 * already has). */
export interface CameraSize {
  readonly width: number;
  readonly height: number;
}

/** The `.battle-grid-iso` world's `translate(x, y)` offset, in the same coordinate
 * space as `isometric.ts`'s projected points — `point.x + camera.x` is exactly where
 * that point lands on screen within the viewport. */
export interface CameraOffset {
  readonly x: number;
  readonly y: number;
}

/** The raw (unclamped) offset that puts `point` at the exact center of a
 * `viewportSize`-sized viewport — `useBattleCamera`'s "follow this unit" target, before
 * `clampCamera` keeps it from scrolling past the map's own edges. */
export function centerOn(point: IsoPoint, viewportSize: CameraSize): CameraOffset {
  return {
    x: viewportSize.width / 2 - point.x,
    y: viewportSize.height / 2 - point.y,
  };
}

/** Nudges a camera offset by a fixed delta — the player's manual pan, from an arrow-key
 * step or a drag's per-move delta. Always passed back through `clampCamera` by the
 * caller, never clamped here itself, so this stays a plain, order-independent add. */
export function panCamera(camera: CameraOffset, dx: number, dy: number): CameraOffset {
  return { x: camera.x + dx, y: camera.y + dy };
}

/** Clamps one axis of a camera offset so the grid never scrolls past showing blank
 * space beyond its own edge — unless the grid is smaller than the viewport on this
 * axis (a narrow window, or in principle a small battlefield), in which case there's
 * nothing to scroll and the grid is centered in the viewport instead of clamped to a
 * range (a min/max clamp would have min > max in that case). `padding` (default 0)
 * loosens both ends of that clamp by a fixed amount, letting the grid scroll that much
 * further past "flush with the edge" — see `clampCamera`'s own doc comment for why. */
function clampAxis(value: number, gridExtent: number, viewportExtent: number, padding = 0): number {
  if (gridExtent <= viewportExtent) {
    const center = (viewportExtent - gridExtent) / 2;
    return Math.min(center + padding, Math.max(center - padding, value));
  }
  const min = viewportExtent - gridExtent - padding; // grid's far edge can go padding px past the viewport's far edge
  const max = padding; // grid's near edge can go padding px past the viewport's own near edge
  return Math.min(max, Math.max(min, value));
}

/** Clamps a camera offset to `gridSize` within `viewportSize`, axis by axis. Every
 * camera update in `useBattleCamera` (the recenter-on-new-turn effect, `pan`, and a
 * zoom-at-a-point) goes through this, so the map can never scroll past its own edges no
 * matter how the offset got there.
 *
 * `horizontalPadding` (default 0, x-axis only) loosens the clamp so the grid can scroll
 * a bit further than "flush with the edge" — real user feedback: "We should be able to
 * pan the isometric map more to the left and right because the player health is hidden
 * [in] the left and right corner." `BattleView.tsx`'s roster panels (`.battle-roster-us`/
 * `.battle-roster-enemy`, `battle.css`) are fixed-width overlays pinned to the viewport's
 * own left/right edges, covering that strip of the map *regardless of camera position* —
 * without extra padding, a unit sitting right at the map's own left or right edge is
 * permanently hidden under the panel, since the strict clamp above stops the camera the
 * instant the grid's edge is flush with the viewport's edge (there's no further to pan).
 * Padding lets the camera go that little bit further, revealing blank space past the
 * grid's true edge in exchange for being able to scroll a previously-hidden unit clear
 * of the panel. No such issue on the y-axis (the panels don't cover the top/bottom
 * edges), hence this only loosens x. */
export function clampCamera(
  camera: CameraOffset,
  gridSize: CameraSize,
  viewportSize: CameraSize,
  horizontalPadding = 0,
): CameraOffset {
  return {
    x: clampAxis(camera.x, gridSize.width, viewportSize.width, horizontalPadding),
    y: clampAxis(camera.y, gridSize.height, viewportSize.height),
  };
}
