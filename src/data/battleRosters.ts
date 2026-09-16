import type { BattleUnitTemplate } from '@/engine/battle';
import type { CharacterId, CountryId } from '@/engine/types';
import { getCharacter } from './characters';

/**
 * Tactical-battle rosters (GAME_PLAN §7.1). Two kinds of unit:
 *
 * - `US_BATTLE_UNITS`: combat stats for every switchable official (`gameStore.ts`'s
 *   `SWITCHABLE_CHARACTERS`) — all 6 fight together regardless of which one is
 *   "active" in the room.
 * - `BATTLE_ROSTERS`: each war-eligible country's opposing lineup.
 *
 * Canada's roster is the six people named when this feature was designed — five real
 * Canadian officials (satirizing their public "elbows up" / tariff-fight posture, same
 * spirit as the rest of the game's real-name cast, GAME_PLAN §14) plus one deliberately
 * fictional wildcard. Greenland's is generic (polar bears, not people) for the same
 * reason it was picked as a launch target: no live real-world conflict, easy to laugh
 * at. Panama and Mexico use invented, clearly-fictional stand-ins rather than real
 * officials, since nobody asked for those specifically.
 *
 * Most units are `range: 1` (melee-adjacent), but the engine's `range` field was always
 * generic Manhattan distance (`engine/battle.ts`'s `targetsInRange`/`attack` don't
 * require adjacency, and don't need to move to attack once something's in range) — two
 * units use that headroom for a *Shining Force*-style ranged kit, traded for a point of
 * `power` since hitting from a distance is worth something: **Musk** (`range: 3`, "lobs
 * a rocket") and Canada's **Mackinaw-jacket guy** (`range: 2`, "fires a bow"). Neither
 * gets a line-of-sight check (nothing in the engine does), so — like every other unit —
 * they can technically hit over the battlefield's obstacles; a minor v1 simplification,
 * not something this change tries to fix.
 *
 * Iran, Venezuela and Russia are new war targets, but — unlike Canada — all three are
 * currently in live, serious real-world conflicts or tensions with the US. Rather than
 * put a real, currently-serving head of state into a "defeat this person" minigame,
 * their rosters are invented archetypes (a spokesperson, a TV anchor, "a guy with a
 * megaphone"), matching the "Mackinaw jacket guy" spirit rather than any real person.
 * They're also war-only, not purchasable — that joke doesn't fit these three.
 */
export const US_BATTLE_UNITS: Readonly<Record<CharacterId, BattleUnitTemplate>> = {
  trump: {
    id: 'trump',
    move: 2,
    range: 1,
    power: 5,
    maxComposure: 16,
    placeholder: { initials: 'DT', color: '#c8323c' },
    sprite: getCharacter('trump').sprite.front,
  },
  vance: {
    id: 'vance',
    move: 3,
    range: 1,
    power: 4,
    maxComposure: 12,
    placeholder: { initials: 'JV', color: '#3a6ea5' },
    sprite: getCharacter('vance').sprite.front,
  },
  bessent: {
    id: 'bessent',
    move: 3,
    range: 1,
    power: 3,
    maxComposure: 12,
    placeholder: { initials: 'SB', color: '#3f9b5b' },
    sprite: getCharacter('bessent').sprite.front,
  },
  lutnick: {
    id: 'lutnick',
    move: 2,
    range: 1,
    power: 4,
    maxComposure: 12,
    placeholder: { initials: 'HL', color: '#b07d2b' },
    sprite: getCharacter('lutnick').sprite.front,
  },
  melania: {
    id: 'melania',
    move: 4,
    range: 1,
    power: 3,
    maxComposure: 10,
    placeholder: { initials: 'M', color: '#8a6bbf' },
    sprite: getCharacter('melania').sprite.front,
  },
  musk: {
    id: 'musk',
    move: 3,
    range: 3,
    power: 4,
    maxComposure: 10,
    placeholder: { initials: 'EM', color: '#2bb0b0' },
    sprite: getCharacter('musk').sprite.front,
  },
};

export const BATTLE_ROSTERS: Readonly<Record<CountryId, readonly BattleUnitTemplate[]>> = {
  canada: [
    {
      id: 'canada-carney',
      nameKey: 'battle.unit.canada.carney',
      move: 2,
      range: 1,
      power: 3,
      maxComposure: 14,
      placeholder: { initials: 'MC', color: '#c8323c' },
      sprite: '/assets/sprites/canada/carney-front.png',
    },
    {
      id: 'canada-trudeau',
      nameKey: 'battle.unit.canada.trudeau',
      move: 3,
      range: 1,
      power: 3,
      maxComposure: 10,
      placeholder: { initials: 'JT', color: '#3a6ea5' },
      sprite: '/assets/sprites/canada/trudeau-front.png',
    },
    {
      id: 'canada-miller',
      nameKey: 'battle.unit.canada.miller',
      move: 2,
      range: 1,
      power: 3,
      maxComposure: 10,
      placeholder: { initials: 'MM', color: '#8f7228' },
      sprite: '/assets/sprites/canada/miller-front.png',
    },
    {
      id: 'canada-joly',
      nameKey: 'battle.unit.canada.joly',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 10,
      placeholder: { initials: 'MJ', color: '#3f9b5b' },
      sprite: '/assets/sprites/canada/joly-front.png',
    },
    {
      id: 'canada-leblanc',
      nameKey: 'battle.unit.canada.leblanc',
      move: 2,
      range: 1,
      power: 3,
      maxComposure: 10,
      placeholder: { initials: 'DL', color: '#8a6bbf' },
      sprite: '/assets/sprites/canada/leblanc-front.png',
    },
    {
      id: 'canada-mackinaw-guy',
      nameKey: 'battle.unit.canada.mackinawGuy',
      move: 3,
      range: 2,
      power: 4,
      maxComposure: 12,
      placeholder: { initials: '?', color: '#b0402c' },
      sprite: '/assets/sprites/canada/mackinaw-guy-front.png',
    },
  ],
  greenland: [
    {
      id: 'greenland-bear-a',
      nameKey: 'battle.unit.greenland.polarBearA',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 12,
      placeholder: { initials: '\u{1F43B}', color: '#e8ecf2' },
    },
    {
      id: 'greenland-bear-b',
      nameKey: 'battle.unit.greenland.polarBearB',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 12,
      placeholder: { initials: '\u{1F43B}', color: '#e8ecf2' },
    },
    {
      id: 'greenland-bear-c',
      nameKey: 'battle.unit.greenland.polarBearC',
      move: 3,
      range: 1,
      power: 3,
      maxComposure: 10,
      placeholder: { initials: '\u{1F43B}', color: '#e8ecf2' },
    },
    {
      id: 'greenland-bear-boss',
      nameKey: 'battle.unit.greenland.polarBearBoss',
      move: 1,
      range: 1,
      power: 6,
      maxComposure: 18,
      placeholder: { initials: '\u{1F43B}', color: '#cfd8e6' },
    },
  ],
  panama: [
    {
      id: 'panama-toll-collector',
      nameKey: 'battle.unit.panama.tollCollector',
      move: 2,
      range: 1,
      power: 3,
      maxComposure: 11,
      placeholder: { initials: '$', color: '#3a6ea5' },
    },
    {
      id: 'panama-tour-guide',
      nameKey: 'battle.unit.panama.tourGuide',
      move: 3,
      range: 1,
      power: 3,
      maxComposure: 10,
      placeholder: { initials: 'TG', color: '#3f9b5b' },
    },
    {
      id: 'panama-ship-enthusiast',
      nameKey: 'battle.unit.panama.shipEnthusiast',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 11,
      placeholder: { initials: '\u{1F6A2}', color: '#8f7228' },
    },
  ],
  mexico: [
    {
      id: 'mexico-mariachi',
      nameKey: 'battle.unit.mexico.mariachi',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 12,
      placeholder: { initials: '\u{1F3B8}', color: '#e0782c' },
    },
    {
      id: 'mexico-churro-vendor',
      nameKey: 'battle.unit.mexico.churroVendor',
      move: 3,
      range: 1,
      power: 3,
      maxComposure: 10,
      placeholder: { initials: 'C', color: '#b07d2b' },
    },
    {
      id: 'mexico-customs-officer',
      nameKey: 'battle.unit.mexico.customsOfficer',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 11,
      placeholder: { initials: 'CO', color: '#3a6ea5' },
    },
  ],
  iran: [
    {
      id: 'iran-spokesperson',
      nameKey: 'battle.unit.iran.spokesperson',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 11,
      placeholder: { initials: 'SP', color: '#3f9b5b' },
    },
    {
      id: 'iran-tv-anchor',
      nameKey: 'battle.unit.iran.tvAnchor',
      move: 2,
      range: 1,
      power: 3,
      maxComposure: 10,
      placeholder: { initials: 'TV', color: '#8f7228' },
    },
    {
      id: 'iran-drone-hobbyist',
      nameKey: 'battle.unit.iran.droneHobbyist',
      move: 3,
      range: 1,
      power: 4,
      maxComposure: 10,
      placeholder: { initials: 'D', color: '#3a6ea5' },
    },
  ],
  venezuela: [
    {
      id: 'venezuela-committee-chair',
      nameKey: 'battle.unit.venezuela.committeeChair',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 11,
      placeholder: { initials: 'CC', color: '#8a6bbf' },
    },
    {
      id: 'venezuela-oil-executive',
      nameKey: 'battle.unit.venezuela.oilExecutive',
      move: 2,
      range: 1,
      power: 3,
      maxComposure: 11,
      placeholder: { initials: 'OE', color: '#3f9b5b' },
    },
    {
      id: 'venezuela-megaphone-guy',
      nameKey: 'battle.unit.venezuela.megaphoneGuy',
      move: 3,
      range: 1,
      power: 4,
      maxComposure: 10,
      placeholder: { initials: '\u{1F4E3}', color: '#e0782c' },
    },
  ],
  russia: [
    {
      id: 'russia-press-secretary',
      nameKey: 'battle.unit.russia.pressSecretary',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 12,
      placeholder: { initials: 'PS', color: '#3a6ea5' },
    },
    {
      id: 'russia-tv-pundit',
      nameKey: 'battle.unit.russia.tvPundit',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 11,
      placeholder: { initials: 'TV', color: '#8f7228' },
    },
    {
      id: 'russia-fur-hat-guy',
      nameKey: 'battle.unit.russia.furHatGuy',
      move: 2,
      range: 1,
      power: 5,
      maxComposure: 12,
      placeholder: { initials: '\u{1F412}', color: '#c8323c' },
    },
  ],
};

export function getBattleRoster(country: CountryId): readonly BattleUnitTemplate[] {
  return BATTLE_ROSTERS[country];
}
