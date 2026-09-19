import { useEffect, useState } from 'react';
import { STAGE_HEIGHT, STAGE_WIDTH } from './constants';

/**
 * Largest zoom that fits the window, filling as much of the screen as the stage's fixed
 * 16:9 aspect ratio allows (real user feedback: "the game should take all the screen,
 * it's too dense"). Used to snap down to the nearest *whole* number (2×, 3×, 4×…) so
 * every pixel stayed crisp — but on most non-4K windows the nearest whole zoom undershot
 * the actual fit by a large margin (e.g. a 1512×944 window fits 3.15×, which used to
 * floor all the way down to a cramped 3× with real unused space on every side), which is
 * exactly the "too dense" complaint. Now returns the exact fit: `image-rendering:
 * pixelated` (global.css) keeps the art reasonably crisp at a fractional zoom too, and
 * filling the window matters more here than perfectly aliased pixel edges. The stage
 * still can't fill *both* dimensions unless the window happens to be exactly 16:9 —
 * `Math.min` picks whichever axis is tighter, so some letterboxing on the other axis is
 * inherent to keeping the pixel art from stretching out of proportion, not a bug. Below
 * 1× (phones/small windows) this already shrank fractionally; unchanged here.
 */
export function computeStageScale(
  viewportWidth: number,
  viewportHeight: number,
  width = STAGE_WIDTH,
  height = STAGE_HEIGHT,
): number {
  const fit = Math.min(viewportWidth / width, viewportHeight / height);
  return Number.isFinite(fit) && fit > 0 ? fit : 1;
}

function currentScale(): number {
  if (typeof window === 'undefined') return 1;
  return computeStageScale(window.innerWidth, window.innerHeight);
}

export function useStageScale(): number {
  const [scale, setScale] = useState(currentScale);

  useEffect(() => {
    const onResize = () => setScale(currentScale());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return scale;
}
