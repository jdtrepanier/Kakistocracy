import { describe, expect, it } from 'vitest';
import { step, type Direction, type GridPosition } from '@/engine/movement';
import { isoDepth } from './isometric';
import { holdPlayerDepth, settlePlayerDepth, type PlayerDepthHold } from './playerDepth';

const ROOM_A = 'oval-office';
const ROOM_B = 'treasury';

/** Mirrors `usePlayerDepth`'s own sequencing: one `holdPlayerDepth` call per move, with an
 * optional `settlePlayerDepth` in between two moves to simulate the CSS glide's timer
 * actually firing before the next key press. */
function moveSequence(
  start: PlayerDepthHold,
  moves: ReadonlyArray<{ depth: number; roomId: string; settleFirst?: boolean }>,
): readonly number[] {
  let hold = start;
  // The settle timer (when it fires) always settles to the *true* depth of whichever move
  // started it, not to whatever the held (possibly Math.max-padded) value happened to be —
  // so track the last true depth/room separately, exactly like the `depth`/`roomId`
  // closed-over values in `usePlayerDepth`'s own `setTimeout`.
  let lastTrueDepth = start.depth;
  let lastTrueRoom = start.roomId;
  const held: number[] = [];
  for (const move of moves) {
    if (move.settleFirst) {
      hold = settlePlayerDepth(lastTrueDepth, lastTrueRoom);
    }
    hold = holdPlayerDepth(hold, move.depth, move.roomId);
    lastTrueDepth = move.depth;
    lastTrueRoom = move.roomId;
    held.push(hold.depth);
  }
  return held;
}

describe('holdPlayerDepth', () => {
  it('jumps immediately to the new depth when it grows (moving to a deeper tile)', () => {
    const prev: PlayerDepthHold = { depth: 3, roomId: ROOM_A };
    expect(holdPlayerDepth(prev, 4, ROOM_A)).toEqual({ depth: 4, roomId: ROOM_A });
  });

  it('holds at the old, higher depth when the new depth is smaller (shallower tile)', () => {
    const prev: PlayerDepthHold = { depth: 4, roomId: ROOM_A };
    expect(holdPlayerDepth(prev, 3, ROOM_A)).toEqual({ depth: 4, roomId: ROOM_A });
  });

  it('is a no-op when depth is unchanged', () => {
    const prev: PlayerDepthHold = { depth: 5, roomId: ROOM_A };
    expect(holdPlayerDepth(prev, 5, ROOM_A)).toEqual({ depth: 5, roomId: ROOM_A });
  });

  it('snaps straight to the new depth on a room change, even if that looks like a drop', () => {
    const prev: PlayerDepthHold = { depth: 9, roomId: ROOM_A };
    // A naive Math.max across rooms would incorrectly hold this at 9.
    expect(holdPlayerDepth(prev, 0, ROOM_B)).toEqual({ depth: 0, roomId: ROOM_B });
  });

  it('snaps straight to the new depth on a room change, even if that looks like a rise', () => {
    const prev: PlayerDepthHold = { depth: 0, roomId: ROOM_A };
    expect(holdPlayerDepth(prev, 9, ROOM_B)).toEqual({ depth: 9, roomId: ROOM_B });
  });
});

describe('settlePlayerDepth', () => {
  it('always returns the true depth, regardless of any prior hold', () => {
    expect(settlePlayerDepth(2, ROOM_A)).toEqual({ depth: 2, roomId: ROOM_A });
  });
});

// Regression coverage for the exact bug report: "It's only fixed when I press Left key or
// Up key. For right and down, it's still disappear." A flat CSS transition-delay on
// z-index (the first, incomplete fix) only works for the up/left case below; it makes the
// down/right case worse, since it delays the very z-index rise that case needs immediately.
describe('four-direction regression (mirrors the reported bug)', () => {
  // A small room where every step changes isoDepth, so each direction's effect on depth
  // is unambiguous.
  const start: GridPosition = { x: 2, y: 2 };

  function depthAfter(dir: Direction): number {
    return isoDepth(step(start, dir));
  }

  it('down and right increase isoDepth (the "deeper tile" case)', () => {
    expect(depthAfter('down')).toBeGreaterThan(isoDepth(start));
    expect(depthAfter('right')).toBeGreaterThan(isoDepth(start));
  });

  it('up and left decrease isoDepth (the "shallower tile" case)', () => {
    expect(depthAfter('up')).toBeLessThan(isoDepth(start));
    expect(depthAfter('left')).toBeLessThan(isoDepth(start));
  });

  it.each<Direction>(['down', 'right'])(
    'moving %s (deeper): the held depth rises immediately, never lagging behind the true depth',
    (dir) => {
      const prev: PlayerDepthHold = { depth: isoDepth(start), roomId: ROOM_A };
      const trueDepth = depthAfter(dir);
      const next = holdPlayerDepth(prev, trueDepth, ROOM_A);
      // If this were still less than trueDepth, the token would paint behind a wall it has
      // already visually passed in front of — the exact "disappears" bug for down/right.
      expect(next.depth).toBe(trueDepth);
    },
  );

  it.each<Direction>(['up', 'left'])(
    'moving %s (shallower): the held depth stays at the old value until the glide settles',
    (dir) => {
      const prev: PlayerDepthHold = { depth: isoDepth(start), roomId: ROOM_A };
      const trueDepth = depthAfter(dir);

      const midGlide = holdPlayerDepth(prev, trueDepth, ROOM_A);
      // If this had already dropped to trueDepth, the token would paint behind a wall it
      // hasn't visually left yet — the "disappears" bug for up/left.
      expect(midGlide.depth).toBe(prev.depth);

      const settled = settlePlayerDepth(trueDepth, ROOM_A);
      expect(settled.depth).toBe(trueDepth);
    },
  );

  it('holding a key in a single direction never drops the held depth mid-stride', () => {
    // Three rapid "down" moves with no settle in between (holding the key down) — the
    // player's actual bug report scenario. Held depth must track the true depth exactly
    // at every step, with no dip.
    let pos = start;
    let hold: PlayerDepthHold = { depth: isoDepth(pos), roomId: ROOM_A };
    let previousHeld = hold.depth;
    for (let i = 0; i < 3; i++) {
      pos = step(pos, 'down');
      hold = holdPlayerDepth(hold, isoDepth(pos), ROOM_A);
      expect(hold.depth).toBeGreaterThanOrEqual(previousHeld);
      expect(hold.depth).toBe(isoDepth(pos));
      previousHeld = hold.depth;
    }
  });

  it('holding a key in a single up/left direction keeps the highest depth until settle', () => {
    // Mirrors two "up" moves in a row, with the CSS glide actually finishing between them
    // (settleFirst) — exercising the settle timer that fires while a key is held.
    const heldSequence = moveSequence({ depth: isoDepth(start), roomId: ROOM_A }, [
      { depth: isoDepth(step(start, 'up')), roomId: ROOM_A },
      {
        depth: isoDepth(step(step(start, 'up'), 'up')),
        roomId: ROOM_A,
        settleFirst: true,
      },
    ]);
    const trueDepths = [isoDepth(step(start, 'up')), isoDepth(step(step(start, 'up'), 'up'))];
    // First move: held at the old (higher) depth, not yet dropped.
    expect(heldSequence[0]).toBe(isoDepth(start));
    // Second move: the timer settled first, so this move starts from the true depth and
    // again holds at the old (still higher) value rather than the newest, lower one.
    expect(heldSequence[1]).toBe(trueDepths[0]);
  });
});
