/**
 * Pure state-transition logic behind `RoomView.tsx`'s `usePlayerDepth` hook — the fix for
 * a bug where the player sprite could momentarily render behind a wall/object block (i.e.
 * visually disappear) while moving quickly. `isoDepth(player.pos)` (see `isometric.ts`)
 * jumps the instant the store updates, but `.room-player`'s `left`/`top` CSS glide to the
 * new tile takes `ROOM_MOVE_TRANSITION_MS` to catch up — so mid-glide, the token's paint
 * order and its actual screen position can disagree.
 *
 * Kept separate from the hook itself (which only supplies the `setTimeout`/React-state
 * glue) and colocated with a test file, following this repo's convention of pure
 * data-in/data-out logic tested directly with Vitest rather than through React rendering.
 * A first attempt fixed this with a flat CSS transition-delay on `z-index`, which only
 * happened to work for two of the four movement directions — see `holdPlayerDepth` below
 * for why a flat delay can't be correct, and `playerDepth.test.ts` for regression coverage
 * of all four.
 */

export interface PlayerDepthHold {
  /** The paint-order depth currently being held (`isoDepth`-style units — not yet turned
   * into a CSS `z-index`, which is the caller's job). */
  readonly depth: number;
  /** Which room this hold applies to — depth is only comparable within one room's grid. */
  readonly roomId: string;
}

/** Call on every `depth`/`roomId` change (i.e. every render where the player's grid
 * position or room changed) to get the depth to hold *immediately*, before the CSS glide
 * finishes catching up:
 * - Same room: `Math.max(prev.depth, depth)`. This is correct for both movement directions
 *   in one expression, which is the actual fix — a flat delay on the *value itself* cannot
 *   be, because the two directions need opposite behavior:
 *   - Moving to a **deeper** tile (grid down/right, higher `isoDepth`) needs the new,
 *     higher depth *immediately*, or the token renders behind a wall it's already visually
 *     passing in front of. `Math.max` picks the new value here since it's already larger.
 *   - Moving to a **shallower** tile (grid up/left, lower `isoDepth`) needs to *keep* the
 *     old, higher depth until the glide actually finishes (`settlePlayerDepth`), or it
 *     renders behind a wall it hasn't visually left yet. `Math.max` picks the old value
 *     here since it's still larger.
 * - Different room: snaps straight to `depth`, ignoring `prev.depth` entirely. Depth values
 *   aren't comparable across two different rooms' grids, so `Math.max`-ing them would be
 *   meaningless — and could itself reintroduce this exact bug in the new room. */
export function holdPlayerDepth(
  prev: PlayerDepthHold,
  depth: number,
  roomId: string,
): PlayerDepthHold {
  if (prev.roomId !== roomId) {
    return { depth, roomId };
  }
  return { depth: Math.max(prev.depth, depth), roomId };
}

/** Call once the CSS position glide has actually finished (`ROOM_MOVE_TRANSITION_MS` after
 * the move that triggered `holdPlayerDepth`) to settle the hold down to the tile's true
 * depth, undoing any `Math.max` padding left over from a move to a shallower tile. */
export function settlePlayerDepth(depth: number, roomId: string): PlayerDepthHold {
  return { depth, roomId };
}
