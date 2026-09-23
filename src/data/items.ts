import type { ItemId } from '@/engine/types';
import type { MessageKey } from '@/i18n/en';

/**
 * Collectible flavor items (`ItemId`'s own doc comment in `engine/types.ts`). Pure
 * flavor, not a mechanic: nothing reads `GameState.items` except the ITEM overlay
 * (`ui/menus/ItemOverlay.tsx`) that lists them. Two so far:
 *
 * - `can-of-meat`: the opening cutscene's can (`ui/screens/IntroScreen.tsx`) — real user
 *   feedback: "the can of meat should stay in your items." Picked up automatically once
 *   the cutscene reaches that beat (`grabItem` in `store/gameStore.ts`), not something
 *   the player has to walk up to.
 * - `autopen`: a real, grabbable room item (same feedback: "you can also put an autopen
 *   item somewhere else that you can grab") — sits on its own `itemAt` tile in the Oval
 *   Office (`data/roomLayouts.ts`), picked up by pressing ITEM while facing it (see
 *   `CrossMenu.tsx`). A satirical prop, not a real mechanic — the game's own "confident
 *   and wrong" tone (GAME_PLAN §1/§14) riffing on the real autopen-signature controversy,
 *   same spirit as the rest of the cast/action catalog.
 *
 * Neither item has real sprite art yet (`icon` is only set for the can, whose art already
 * existed for the cutscene) — the autopen falls back to `placeholder` (colour + initials),
 * same "real art if present, else a placeholder" pattern `data/characters.ts`/
 * `data/battleRosters.ts` already use for a character with no sprite sheet yet.
 */
export interface ItemDef {
  readonly id: ItemId;
  readonly nameKey: MessageKey;
  readonly descriptionKey: MessageKey;
  /** Sprite/icon path, when real art exists. Falls back to `placeholder` otherwise. */
  readonly icon?: string;
  readonly placeholder: { readonly initials: string; readonly color: string };
}

const ITEMS: Readonly<Record<ItemId, ItemDef>> = {
  'can-of-meat': {
    id: 'can-of-meat',
    nameKey: 'item.canOfMeat.name',
    descriptionKey: 'item.canOfMeat.description',
    icon: '/assets/items/can-of-meat.png',
    placeholder: { initials: 'CM', color: '#8f7228' },
  },
  autopen: {
    id: 'autopen',
    nameKey: 'item.autopen.name',
    descriptionKey: 'item.autopen.description',
    placeholder: { initials: 'AP', color: '#3a6ea5' },
  },
};

export function getItem(id: ItemId): ItemDef {
  return ITEMS[id];
}

export const ALL_ITEM_IDS: readonly ItemId[] = ['can-of-meat', 'autopen'];
