import { useEffect, useState } from 'react';
import { STAGE_HEIGHT, STAGE_WIDTH } from './constants';

/**
 * Largest whole-number zoom that fits the window, so pixels stay crisp (2×, 3×, 4×…).
 * On screens smaller than the stage (phones), it shrinks to fit instead.
 */
export function computeStageScale(
  viewportWidth: number,
  viewportHeight: number,
  width = STAGE_WIDTH,
  height = STAGE_HEIGHT,
): number {
  const fit = Math.min(viewportWidth / width, viewportHeight / height);
  if (!Number.isFinite(fit) || fit <= 0) return 1;
  return fit < 1 ? fit : Math.floor(fit);
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
