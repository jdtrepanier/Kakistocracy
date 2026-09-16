import { checkAvailability, type ActionDef, type UnavailableReason } from '@/engine/actions';
import { computeSuccessChance } from '@/engine/resolve';
import type { MessageKey } from '@/i18n/en';
import { roomLabelKey } from '@/data/rooms';
import { useGameStore } from '@/store/gameStore';
import { useT } from '../useT';

const UNAVAILABLE_KEY: Readonly<Record<UnavailableReason, MessageKey>> = {
  ended: 'screen.unavailable.ended',
  iq: 'screen.unavailable.iq',
  ea: 'screen.unavailable.ea',
  limit: 'screen.unavailable.limit',
  wrongOfficial: 'screen.unavailable.wrongOfficial',
  flags: 'screen.unavailable.flags',
};

/** One action as a button: name, room tag, EA cost and success chance; disabled with a reason. */
export function ActionButton({ action }: { action: ActionDef }) {
  const t = useT();
  const game = useGameStore((s) => s.game);
  const activeCharacter = useGameStore((s) => s.activeCharacter);
  const beginAction = useGameStore((s) => s.beginAction);

  const availability = checkAvailability(action, game, activeCharacter);
  const chance = computeSuccessChance(action);

  return (
    <li className="action-item">
      <button
        type="button"
        className="pixel-button action-button"
        disabled={!availability.ok}
        onClick={() => beginAction(action.id)}
        title={availability.ok ? undefined : t(UNAVAILABLE_KEY[availability.reason])}
      >
        <span className="action-name">{t(action.nameKey)}</span>
        <span className="action-meta">
          <span className="action-room">{t(roomLabelKey(action.room))}</span>
          <span className="action-cost">{t('screen.cost', { n: action.cost.ea })}</span>
          <span className="action-chance">{t('screen.successChance', { n: chance })}</span>
        </span>
      </button>
    </li>
  );
}
