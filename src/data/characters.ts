import type { Direction } from '@/engine/movement';
import type { CharacterId } from '@/engine/types';
import usData from './characters/us.json';

/**
 * The name layer. Every name shown in the game comes from here, so switching to a
 * parody-name build is a one-line change (NAME_MODE). See docs/GAME_PLAN.md §14.
 *
 * **Backed by `data/characters/us.json`, not a hardcoded array.** User request: "Each
 * character's information should also be in a json file" — the same hand-editable-JSON
 * treatment `data/battlegrounds.ts` already got for map layouts (`data/battlegrounds/
 * README.md`), now for character data too. `us.json` merges what used to be split across
 * two places — this file's own display info (name/short/placeholder/sprite) and
 * `battleRosters.ts`'s `US_BATTLE_UNITS` combat stats/quirks for the same six officials —
 * into one object per character (the user's explicit choice when asked: everything about
 * one character belongs in one file, not two systems that have to stay in sync by hand).
 * This file only reads the display fields back out; `battleRosters.ts` reads the same
 * `us.json` a second time for the stats/quirks (see its own doc comment) and still calls
 * `getCharacter(id).sprite` from here for sprite art, exactly like before — only the data's
 * *source* changed, not how these two files relate to each other.
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

const CHARACTER_IDS: ReadonlySet<CharacterId> = new Set<CharacterId>([
  'trump',
  'vance',
  'bessent',
  'lutnick',
  'melania',
  'musk',
]);

function parseCharacterId(raw: unknown, label: string): CharacterId {
  if (typeof raw !== 'string' || !CHARACTER_IDS.has(raw as CharacterId)) {
    throw new Error(`${label}: "${raw}" is not a known CharacterId (see engine/types.ts)`);
  }
  return raw as CharacterId;
}

function parseNameModeRecord(raw: unknown, label: string): Readonly<Record<NameMode, string>> {
  const obj = raw as { real?: unknown; parody?: unknown } | null;
  if (
    obj === null ||
    typeof obj !== 'object' ||
    typeof obj.real !== 'string' ||
    typeof obj.parody !== 'string'
  ) {
    throw new Error(
      `${label}: expected {"real": string, "parody": string}, got ${JSON.stringify(raw)}`,
    );
  }
  return { real: obj.real, parody: obj.parody };
}

function parsePlaceholder(
  raw: unknown,
  label: string,
): { readonly initials: string; readonly color: string } {
  const obj = raw as { initials?: unknown; color?: unknown } | null;
  if (
    obj === null ||
    typeof obj !== 'object' ||
    typeof obj.initials !== 'string' ||
    typeof obj.color !== 'string'
  ) {
    throw new Error(
      `${label}: expected {"initials": string, "color": string}, got ${JSON.stringify(raw)}`,
    );
  }
  return { initials: obj.initials, color: obj.color };
}

/** Every US official has all 4 poses today, unlike a `BattleUnitSprite` (`battleRosters.ts`)
 * where only `front` is required — so this requires all 4, matching `CharacterSprite`. */
function parseCharacterSprite(raw: unknown, label: string): CharacterSprite {
  const obj = raw as Partial<Record<keyof CharacterSprite, unknown>> | null;
  if (obj === null || typeof obj !== 'object') {
    throw new Error(`${label}: expected a sprite object, got ${JSON.stringify(raw)}`);
  }
  const sprite: Partial<Record<keyof CharacterSprite, string>> = {};
  for (const pose of ['front', 'back', 'left', 'right'] as const) {
    const value = obj[pose];
    if (typeof value !== 'string') {
      throw new Error(`${label}.${pose}: expected a string path, got ${JSON.stringify(value)}`);
    }
    sprite[pose] = value;
  }
  return sprite as CharacterSprite;
}

// Exported (like data/battlegrounds.ts's own parseGrid) so tests can exercise the JSON
// validation directly with synthetic bad input.
export function parseCharacterDef(raw: unknown, label: string): CharacterDef {
  const obj = raw as {
    id?: unknown;
    name?: unknown;
    short?: unknown;
    placeholder?: unknown;
    sprite?: unknown;
  } | null;
  if (obj === null || typeof obj !== 'object') {
    throw new Error(`${label}: expected a character object, got ${JSON.stringify(raw)}`);
  }
  return {
    id: parseCharacterId(obj.id, `${label} "id"`),
    name: parseNameModeRecord(obj.name, `${label} "name"`),
    short: parseNameModeRecord(obj.short, `${label} "short"`),
    placeholder: parsePlaceholder(obj.placeholder, `${label} "placeholder"`),
    sprite: parseCharacterSprite(obj.sprite, `${label} "sprite"`),
  };
}

export const CHARACTERS: readonly CharacterDef[] = (usData as readonly unknown[]).map((raw, i) =>
  parseCharacterDef(raw, `characters/us.json[${i}]`),
);

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
