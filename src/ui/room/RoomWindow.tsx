import { roomLabelKey } from '@/data/rooms';
import { useGameStore } from '@/store/gameStore';
import { useT } from '../useT';

/** Top-right info box (GAME_PLAN §11): the room the party is currently in. */
export function RoomWindow() {
  const t = useT();
  const roomId = useGameStore((s) => s.player.roomId);

  return (
    <div className="room-window" aria-label={t('room.window.label')}>
      <span className="room-window-name">{t(roomLabelKey(roomId))}</span>
    </div>
  );
}
