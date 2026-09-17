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
 * range (a min/max clamp would have min > max in that case). */
function clampAxis(value: number, gridExtent: number, viewportExtent: number): number {
  if (gridExtent <= viewportExtent) return (viewportExtent - gridExtent) / 2;
  const min = viewportExtent - gridExtent; // grid's far edge lands on the viewport's far edge
  const max = 0; // grid's near edge can't be pushed past the viewport's own near edge
  return Math.min(max, Math.max(min, value));
}

/** Clamps a camera offset to `gridSize` within `viewportSize`, axis by axis. Every
 * camera update in `useBattleCamera` (the recenter-on-new-turn effect, and `pan`) goes
 * through this, so the map can never scroll past its own edges no matter how the
 * offset got there. */
export function clampCamera(
  camera: CameraOffset,
  gridSize: CameraSize,
  viewportSize: CameraSize,
): CameraOffset {
  return {
    x: clampAxis(camera.x, gridSize.width, viewportSize.width),
    y: clampAxis(camera.y, gridSize.height, viewportSize.height),
  };
}
