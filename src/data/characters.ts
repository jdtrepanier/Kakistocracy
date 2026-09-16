import type { Direction } from '@/engine/movement';
import type { CharacterId } from '@/engine/types';

/**
 * The name layer. Every name shown in the game comes from here, so switching to a
 * parody-name build is a one-line change (NAME_MODE). See docs/GAME_PLAN.md §14.
 */
export type NameMode = 'real' | 'parody';

export const NAME_MODE: NameMode = 'real';

/** One 4-direction pixel-art sprite set (`public/assets/sprites/us/`), cropped from the
 * cabinet reference sheet (v2: a transparent-background sheet whose 4 poses per character
 * are diagonal 3/4 views — front-left/front-right/back-left/back-right — rather than
 * straight cardinal ones). Each slot here is picked to match the screen diagonal that
 * `ui/room/isometric.ts`'s `projectIso` actually draws that `Direction` moving toward:
 * `down` moves screen-SW (`front` = the front-left pose), `up` moves screen-NE (`back` =
 * back-right), `left` moves screen-NW (`left` = back-left), `right` moves screen-SE
 * (`right` = front-right). See `spriteForDirection` below. */
export interface CharacterSprite {
  readonly front: string;
  readonly back: string;
  readonly left: string;
  readonly right: string;
}

export interface CharacterDef {
  readonly id: CharacterId;
  readonly name: Readonly<Record<NameMode, string>>;
  /** Short label for tight UI spots (max 8 characters at 8px = 64px). */
  readonly short: Readonly<Record<NameMode, string>>;
  /** Colour + initials, kept as a fallback for any spot that renders a character before
   * `sprite` is available (or a future character without art yet). */
  readonly placeholder: { readonly initials: string; readonly color: string };
  readonly sprite: CharacterSprite;
}

export const CHARACTERS: readonly CharacterDef[] = [
  {
    id: 'trump',
    name: { real: 'Donald Trump', parody: 'The Chaos King' },
    short: { real: 'TRUMP', parody: 'KING' },
    placeholder: { initials: 'DT', color: '#c8323c' },
    sprite: {
      front: '/assets/sprites/us/trump-front.png',
      back: '/assets/sprites/us/trump-back.png',
      left: '/assets/sprites/us/trump-left.png',
      right: '/assets/sprites/us/trump-right.png',
    },
  },
  {
    id: 'vance',
    name: { real: 'JD Vance', parody: 'The Flip-Flop Monk' },
    short: { real: 'VANCE', parody: 'MONK' },
    placeholder: { initials: 'JV', color: '#3a6ea5' },
    sprite: {
      front: '/assets/sprites/us/vance-front.png',
      back: '/assets/sprites/us/vance-back.png',
      left: '/assets/sprites/us/vance-left.png',
      right: '/assets/sprites/us/vance-right.png',
    },
  },
  {
    id: 'bessent',
    name: { real: 'Scott Bessent', parody: 'The Hedge-Fund Sorcerer' },
    short: { real: 'BESSENT', parody: 'SORCERER' },
    placeholder: { initials: 'SB', color: '#3f9b5b' },
    sprite: {
      front: '/assets/sprites/us/bessent-front.png',
      back: '/assets/sprites/us/bessent-back.png',
      left: '/assets/sprites/us/bessent-left.png',
      right: '/assets/sprites/us/bessent-right.png',
    },
  },
  {
    id: 'lutnick',
    name: { real: 'Howard Lutnick', parody: 'The Tariff Paladin' },
    short: { real: 'LUTNICK', parody: 'PALADIN' },
    placeholder: { initials: 'HL', color: '#b07d2b' },
    sprite: {
      front: '/assets/sprites/us/lutnick-front.png',
      back: '/assets/sprites/us/lutnick-back.png',
      left: '/assets/sprites/us/lutnick-left.png',
      right: '/assets/sprites/us/lutnick-right.png',
    },
  },
  {
    id: 'melania',
    name: { real: 'Melania', parody: 'The Ghost Rogue' },
    short: { real: 'MELANIA', parody: 'ROGUE' },
    placeholder: { initials: 'M', color: '#8a6bbf' },
    sprite: {
      front: '/assets/sprites/us/melania-front.png',
      back: '/assets/sprites/us/melania-back.png',
      left: '/assets/sprites/us/melania-left.png',
      right: '/assets/sprites/us/melania-right.png',
    },
  },
  {
    id: 'musk',
    name: { real: 'Elon Musk', parody: 'The Techno-Shaman' },
    short: { real: 'MUSK', parody: 'SHAMAN' },
    placeholder: { initials: 'EM', color: '#2bb0b0' },
    sprite: {
      front: '/assets/sprites/us/musk-front.png',
      back: '/assets/sprites/us/musk-back.png',
      left: '/assets/sprites/us/musk-left.png',
      right: '/assets/sprites/us/musk-right.png',
    },
  },
];

/** Maps a room-movement `Direction` to the matching sprite pose — see the `CharacterSprite`
 * doc comment above for how each slot was picked to match its actual screen diagonal. */
export function spriteForDirection(sprite: CharacterSprite, direction: Direction): string {
  switch (direction) {
    case 'down':
      return sprite.front;
    case 'up':
      return sprite.back;
    case 'left':
      return sprite.left;
    case 'right':
      return sprite.right;
  }
}

export function getCharacter(id: CharacterId): CharacterDef {
  const character = CHARACTERS.find((c) => c.id === id);
  if (!character) throw new Error(`Unknown character: ${id}`);
  return character;
}

export function displayName(id: CharacterId, mode: NameMode = NAME_MODE): string {
  return getCharacter(id).name[mode];
}

export function shortName(id: CharacterId, mode: NameMode = NAME_MODE): string {
  return getCharacter(id).short[mode];
}
