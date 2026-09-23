import { useEffect, useState } from 'react';
import type { IsoPoint } from '../room/isometric';
import {
  centerOn,
  clampCamera,
  panCamera,
  type CameraOffset,
  type CameraSize,
} from './battleCamera';

/**
 * Battle camera state (`BattleView.tsx`): re-centers on `followPoint` every time
 * `followKey` changes — a new unit's turn, or the active unit moving during its own
 * turn (`BattleView.tsx` builds `followKey` from both, so either one re-triggers this)
 * — Shining-Force-style auto-follow, and exposes `pan` for the player to look around
 * the rest of the (now much bigger) battlefield by hand without moving any unit. All
 * the actual centering/clamping math lives in `battleCamera.ts`'s pure, tested
 * functions; this hook is only the React glue (state plus the "recenter" effect), the
 * same split `room/playerDepth.ts` (pure, tested) has from `RoomView.tsx`'s
 * `usePlayerDepth` (glue only).
 *
 * `horizontalPadding` is passed straight through to every `clampCamera` call here —
 * see that function's own doc comment (real user feedback about the roster panels
 * hiding units at the map's left/right edges).
 *
 * `setCameraFor` is the escape hatch `BattleView.tsx`'s zoom-at-a-point handlers need:
 * unlike `pan` (a fixed delta against the *current* `gridSize`), a zoom change needs to
 * set an exact new offset clamped against the grid's *new* (about-to-be-applied) zoomed
 * size, which isn't `gridSize` yet on the render that triggers the zoom — so the caller
 * computes that new size itself and passes it in alongside the raw offset. */
export function useBattleCamera(
  gridSize: CameraSize,
  viewportSize: CameraSize,
  followPoint: IsoPoint,
  followKey: string,
  horizontalPadding = 0,
): {
  camera: CameraOffset;
  pan: (dx: number, dy: number) => void;
  setCameraFor: (raw: CameraOffset, gridSizeAt: CameraSize) => void;
} {
  const [camera, setCamera] = useState<CameraOffset>(() =>
    clampCamera(centerOn(followPoint, viewportSize), gridSize, viewportSize, horizontalPadding),
  );

  // Recenters whenever the turn (or the active unit's own position) changes, and also
  // once the viewport's real size comes in from `useElementSize`'s ResizeObserver
  // (`viewportSize` starts at {0, 0} on the very first render, before anything has been
  // measured) — a manual pan mid-turn, or a zoom (see `setCameraFor` above), is
  // deliberately left alone by everything else, including a same-turn re-render, since
  // none of `followKey`/these sizes changed.
  useEffect(() => {
    setCamera(
      clampCamera(centerOn(followPoint, viewportSize), gridSize, viewportSize, horizontalPadding),
    );
    // followPoint/gridSize are read fresh each time this fires, not tracked as deps —
    // deliberately, since only a turn/position change (followKey) or a real resize
    // should ever yank the camera back to center.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followKey, viewportSize.width, viewportSize.height, horizontalPadding]);

  const pan = (dx: number, dy: number) => {
    setCamera((prev) =>
      clampCamera(panCamera(prev, dx, dy), gridSize, viewportSize, horizontalPadding),
    );
  };

  const setCameraFor = (raw: CameraOffset, gridSizeAt: CameraSize) => {
    setCamera(clampCamera(raw, gridSizeAt, viewportSize, horizontalPadding));
  };

  return { camera, pan, setCameraFor };
}
