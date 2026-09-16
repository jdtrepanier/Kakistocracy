import { useEffect, useState, type RefObject } from 'react';

interface ElementSize {
  readonly width: number;
  readonly height: number;
}

const ZERO_SIZE: ElementSize = { width: 0, height: 0 };

/** Tracks an element's content box size via `ResizeObserver`, for the isometric room
 * camera (`RoomView.tsx`) to center on the player. Returns `{0, 0}` until the element is
 * mounted and measured once. */
export function useElementSize(ref: RefObject<HTMLElement | null>): ElementSize {
  const [size, setSize] = useState<ElementSize>(ZERO_SIZE);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return size;
}
