import { useEffect, useRef, type ReactNode } from 'react';
import { useGameStore } from '@/store/gameStore';

/**
 * Wraps its children in a layer that plays a brief shake animation (`.stage-shake`,
 * `styles/global.css`) every time `shakeSeq` changes (GAME_PLAN §16/§17's "juice" —
 * `store/gameStore.ts`'s `triggerShake`, called on a failed action or a landed battle
 * hit). A plain CSS class toggle wouldn't replay the animation if it were still applied
 * from the last trigger, so this removes and re-adds the class with a forced reflow in
 * between — the standard way to restart a CSS animation from script.
 *
 * Deliberately a wrapper *inside* `.stage`, not applied to `.stage` itself: `.stage`
 * already carries the pixel-art zoom (`App.tsx`'s inline `transform: scale(...)`), and
 * animating `transform` on that same element would replace the zoom for the animation's
 * duration instead of shaking the already-zoomed view. This layer has no transform of
 * its own otherwise, so the shake is free to use it.
 */
export function ScreenShake({ children }: { children: ReactNode }) {
  const shakeSeq = useGameStore((s) => s.shakeSeq);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || shakeSeq === 0) return;
    el.classList.remove('stage-shake');
    void el.offsetWidth; // force a reflow so a retrigger mid-shake still restarts cleanly
    el.classList.add('stage-shake');
  }, [shakeSeq]);

  return (
    <div ref={ref} className="stage-shake-layer">
      {children}
    </div>
  );
}
