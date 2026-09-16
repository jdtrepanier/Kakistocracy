import { ACTIONS } from '@/data/actions';
import { roomLabelKey } from '@/data/rooms';
import type { RoomId } from '@/engine/actions';
import { useGameStore } from '@/store/gameStore';
import { ActionButton } from '../menus/ActionButton';
import { useT } from '../useT';

/**
 * The action list, either scoped to one room's object (DECREE — GAME_PLAN §11) or the
 * full catalog (the toolbar's "Executive Actions", kept as an escape hatch so every
 * action stays reachable even though not every room in GAME_PLAN §10 exists yet).
 */
export function ActionsOverlay({ room }: { room?: RoomId }) {
  const t = useT();
  const closeOverlay = useGameStore((s) => s.closeOverlay);
  const actions = room === undefined ? ACTIONS : ACTIONS.filter((a) => a.room === room);
  const title =
    room === undefined
      ? t('screen.actionsTitle')
      : t('screen.decreeTitle', { room: t(roomLabelKey(room)) });

  return (
    <div className="menu-overlay">
      <button type="button" className="pixel-button menu-overlay-close" onClick={closeOverlay}>
        {t('screen.close')}
      </button>
      <h2 className="menu-overlay-title">{title}</h2>
      {actions.length === 0 ? (
        <p className="report-empty">{t('screen.decreeEmpty')}</p>
      ) : (
        <ul className="action-list">
          {actions.map((action) => (
            <ActionButton key={action.id} action={action} />
          ))}
        </ul>
      )}
    </div>
  );
}
