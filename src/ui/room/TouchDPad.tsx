import { useEffect, useRef, type PointerEvent } from 'react';
import type { Direction } from '@/engine/movement';
import type { MessageKey } from '@/i18n/en';
import { useGameStore } from '@/store/gameStore';
import { useT } from '../useT';

/** How often a held D-pad button repeats a step. Chosen to match the room camera's own
 * move glide (`ROOM_MOVE_TRANSITION_MS` in `isometric.ts`) so a held touch feels the same
 * speed as holding an arrow key already did via the browser's native key-repeat. */
const DPAD_REPEAT_MS = 130;

const DIRECTIONS: readonly Direction[] = ['up', 'right', 'down', 'left'];

const DIRECTION_LABEL_KEY: Readonly<Record<Direction, MessageKey>> = {
  up: 'room.dpad.up',
  down: 'room.dpad.down',
  left: 'room.dpad.left',
  right: 'room.dpad.right',
};

const DIRECTION_ARROW: Readonly<Record<Direction, string>> = {
  up: '▲',
  down: '▼',
  left: '◀',
  right: '▶',
};

/**
 * Touch equivalent of `RoomView.tsx`'s arrow-key/WASD movement. Every other interaction
 * in the game (the cross menu, action lists, the world map, battle tiles) is already a
 * plain `<button onClick>`, which a tap already fires — walking around a room was the one
 * interaction with no touch equivalent at all, since it only ever listened for
 * `onKeyDown`. A phone/tablet player had no keyboard, so they could reach the toolbar's
 * "Executive Actions" escape hatch and the World Map, but could never walk to a room's
 * DECREE object or through a door.
 *
 * A tap steps once; a held press repeats every `DPAD_REPEAT_MS`, the touch equivalent of
 * holding an arrow key and letting the browser's key-repeat take over. Pointer events
 * (not separate mouse/touch handlers) so the same code handles a stylus or a mouse click
 * too, though `.room-dpad`'s own CSS (`room.css`) hides it on devices with a real
 * mouse/trackpad (`hover: hover` + `pointer: fine`) so desktop keyboard players don't get
 * their tiny 480×270 stage cluttered with controls they'll never tap.
 */
export function TouchDPad() {
  const t = useT();
  const movePlayer = useGameStore((s) => s.movePlayer);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRepeat = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Belt-and-suspenders: stop a held repeat if the component unmounts mid-press (e.g.
  // the room changes underneath the pointer via a door transition).
  useEffect(() => stopRepeat, []);

  const startRepeat = (dir: Direction) => (event: PointerEvent) => {
    event.preventDefault();
    stopRepeat();
    movePlayer(dir);
    timerRef.current = setInterval(() => movePlayer(dir), DPAD_REPEAT_MS);
  };

  return (
    <div className="room-dpad" aria-label={t('room.dpad.label')}>
      {DIRECTIONS.map((dir) => (
        <button
          key={dir}
          type="button"
          className={`pixel-button room-dpad-btn room-dpad-btn-${dir}`}
          aria-label={t(DIRECTION_LABEL_KEY[dir])}
          onPointerDown={startRepeat(dir)}
          onPointerUp={stopRepeat}
          onPointerCancel={stopRepeat}
          onPointerLeave={stopRepeat}
        >
          <span aria-hidden="true">{DIRECTION_ARROW[dir]}</span>
        </button>
      ))}
    </div>
  );
}
