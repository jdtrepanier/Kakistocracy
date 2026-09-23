import { describe, expect, it } from 'vitest';
import { centerOn, clampCamera, panCamera } from './battleCamera';

describe('centerOn', () => {
  it('offsets so the given point lands at the exact center of the viewport', () => {
    expect(centerOn({ x: 100, y: 50 }, { width: 400, height: 200 })).toEqual({ x: 100, y: 50 });
  });

  it('handles a point at the origin', () => {
    expect(centerOn({ x: 0, y: 0 }, { width: 300, height: 100 })).toEqual({ x: 150, y: 50 });
  });
});

describe('panCamera', () => {
  it('adds the delta to the camera offset', () => {
    expect(panCamera({ x: 10, y: -5 }, 4, 6)).toEqual({ x: 14, y: 1 });
  });

  it('is a no-op for a zero delta', () => {
    expect(panCamera({ x: 7, y: 3 }, 0, 0)).toEqual({ x: 7, y: 3 });
  });
});

describe('clampCamera', () => {
  const bigGrid = { width: 1000, height: 800 };
  const viewport = { width: 400, height: 200 };

  it('passes an in-range offset through unchanged when the grid is bigger than the viewport', () => {
    expect(clampCamera({ x: -300, y: -200 }, bigGrid, viewport)).toEqual({ x: -300, y: -200 });
  });

  it('clamps so the grid never shows blank space past its right/bottom edge', () => {
    // Anything past the most-negative allowed offset gets pulled back to it — the
    // grid's far edge lands exactly on the viewport's far edge, nothing further.
    expect(clampCamera({ x: -900, y: -700 }, bigGrid, viewport)).toEqual({
      x: viewport.width - bigGrid.width,
      y: viewport.height - bigGrid.height,
    });
  });

  it('clamps so the grid never shows blank space past its left/top edge', () => {
    expect(clampCamera({ x: 50, y: 30 }, bigGrid, viewport)).toEqual({ x: 0, y: 0 });
  });

  it('centers a grid axis that is smaller than the viewport instead of clamping to a range', () => {
    const smallGrid = { width: 100, height: 800 };
    // Whatever x was requested, a grid narrower than the viewport is just centered —
    // there's nothing to scroll on that axis.
    expect(clampCamera({ x: -999, y: -700 }, smallGrid, viewport)).toEqual({
      x: (viewport.width - smallGrid.width) / 2,
      y: viewport.height - smallGrid.height,
    });
  });

  it('centers a grid that exactly matches the viewport on both axes (nothing to scroll)', () => {
    expect(clampCamera({ x: -50, y: 50 }, viewport, viewport)).toEqual({ x: 0, y: 0 });
  });

  // `horizontalPadding` (real user feedback: "We should be able to pan the isometric
  // map more the the left and right because the player health is hidden the left and
  // right corner" — `BattleView.tsx`'s fixed-width roster overlay panels hide whatever
  // sits at the map's own left/right edge, and the plain clamp above stops the camera
  // the instant the grid is flush with the viewport, with no further to pan).
  describe('horizontalPadding', () => {
    it('lets the grid scroll padding px past its right edge (x only)', () => {
      expect(clampCamera({ x: -900, y: -700 }, bigGrid, viewport, 92)).toEqual({
        x: viewport.width - bigGrid.width - 92,
        y: viewport.height - bigGrid.height, // y unaffected — no padding param for it
      });
    });

    it('lets the grid scroll padding px past its left edge (x only)', () => {
      expect(clampCamera({ x: 900, y: 700 }, bigGrid, viewport, 92)).toEqual({
        x: 92,
        y: 0, // y unaffected
      });
    });

    it('still clamps normally (no extra range) when padding is 0 or omitted', () => {
      expect(clampCamera({ x: -900, y: -700 }, bigGrid, viewport, 0)).toEqual(
        clampCamera({ x: -900, y: -700 }, bigGrid, viewport),
      );
    });

    it('also widens the range for a grid axis smaller than the viewport (centered case)', () => {
      const smallGrid = { width: 100, height: 800 };
      const center = (viewport.width - smallGrid.width) / 2;
      // Within padding of center: passed through unchanged, not snapped back to center.
      expect(clampCamera({ x: center + 20, y: -700 }, smallGrid, viewport, 30)).toEqual({
        x: center + 20,
        y: viewport.height - smallGrid.height,
      });
      // Past padding: clamped to center ± padding, same shape as the big-grid case.
      expect(clampCamera({ x: center + 999, y: -700 }, smallGrid, viewport, 30)).toEqual({
        x: center + 30,
        y: viewport.height - smallGrid.height,
      });
    });
  });
});
