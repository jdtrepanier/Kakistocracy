import { getItem } from '@/data/items';
import { useGameStore } from '@/store/gameStore';
import { useT } from '../useT';

/** The real ITEM inventory (GAME_PLAN §11), replacing the old permanent `StubOverlay`
 * now that `data/items.ts` has real collectibles to list — a plain list of whatever's
 * in `game.items`, icon-or-placeholder plus name and description, same "real art if
 * present, else a colored placeholder" pattern `BattleView.tsx`'s roster rows already
 * use for `battleRosters.ts`'s units. */
export function ItemOverlay() {
  const t = useT();
  const closeOverlay = useGameStore((s) => s.closeOverlay);
  const items = useGameStore((s) => s.game.items);

  return (
    <div className="menu-overlay">
      <button type="button" className="pixel-button menu-overlay-close" onClick={closeOverlay}>
        {t('screen.close')}
      </button>
      <h2 className="menu-overlay-title">{t('menu.item')}</h2>
      {items.length === 0 ? (
        <p className="menu-overlay-body">{t('item.empty')}</p>
      ) : (
        <ul className="item-list">
          {items.map((id) => {
            const item = getItem(id);
            return (
              <li key={id} className="item-row">
                {item.icon ? (
                  <img className="item-icon" src={item.icon} alt="" aria-hidden="true" />
                ) : (
                  <span
                    className="item-icon item-icon-placeholder"
                    style={{ background: item.placeholder.color }}
                    aria-hidden="true"
                  >
                    {item.placeholder.initials}
                  </span>
                )}
                <span className="item-info">
                  <span className="item-name">{t(item.nameKey)}</span>
                  <span className="item-description">{t(item.descriptionKey)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
