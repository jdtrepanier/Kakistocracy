import type { RoomId } from '@/engine/actions';
import type { MessageKey } from '@/i18n/en';

/**
 * i18n label for each room (shown as a small tag next to an action until Phase 2's
 * actual room screens exist). Exhaustive over `RoomId`, so a new room without a label
 * is a compile error rather than a blank tag.
 */
export const ROOM_LABEL_KEY: Readonly<Record<RoomId, MessageKey>> = {
  ovalOffice: 'room.ovalOffice',
  situationRoom: 'room.situationRoom',
  treasury: 'room.treasury',
  federalReserve: 'room.federalReserve',
  commerce: 'room.commerce',
  pentagon: 'room.pentagon',
  mapRoom: 'room.mapRoom',
  starbase: 'room.starbase',
  nationalMall: 'room.nationalMall',
  roseGarden: 'room.roseGarden',
  capitol: 'room.capitol',
  marALago: 'room.marALago',
};

export function roomLabelKey(room: RoomId): MessageKey {
  return ROOM_LABEL_KEY[room];
}
