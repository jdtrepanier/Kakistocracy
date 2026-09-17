import { useEffect, useState } from 'react';

/**
 * Animates a displayed number from `from` to `to` over `durationMs` (GAME_PLAN §16/§17's
 * "juice" — tick-up numbers), easing out so it settles rather than stopping abruptly.
 * Restarts whenever `from`/`to` actually change — which, for how this is used (a report
 * row that mounts once per result, already knowing both its start and end value), means
 * once per mount, not a general "value changed" ticker that fights re-renders.
 *
 * Returns the raw interpolated number, not a formatted string — callers still run it
 * through their usual `formatStatValue`/etc. so a mid-count frame reads with the same
 * unit and rounding as the settled value (e.g. "$41.3T" ticking up to "$42.0T"), and
 * `prefers-reduced-motion` isn't special-cased here since a snapped single frame from
 * `from` to `to` is exactly what an instant jump looks like anyway.
 */
export function useTickUp(from: number, to: number, durationMs = 700): number {
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (from === to) {
      setValue(to);
      return;
    }
    if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }

    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - (1 - t) * (1 - t);
      setValue(from + (to - from) * eased);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [from, to, durationMs]);

  return value;
}
