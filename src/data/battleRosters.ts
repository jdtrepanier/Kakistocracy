import type {
  BattleMagic,
  BattleMagicKind,
  BattleUnitSprite,
  BattleUnitTemplate,
} from '@/engine/battle';
import type { CharacterId, CountryId } from '@/engine/types';
import type { MessageKey } from '@/i18n/en';
import { en } from '@/i18n/en';
import { getCharacter } from './characters';
import canadaData from './characters/canada.json';
import greenlandData from './characters/greenland.json';
import iranData from './characters/iran.json';
import mexicoData from './characters/mexico.json';
import panamaData from './characters/panama.json';
import russiaData from './characters/russia.json';
import usData from './characters/us.json';
import venezuelaData from './characters/venezuela.json';

/**
 * Tactical-battle rosters (GAME_PLAN §7.1). Two kinds of unit:
 *
 * - `US_BATTLE_UNITS`: combat stats for every switchable official (`gameStore.ts`'s
 *   `SWITCHABLE_CHARACTERS`) — all 6 fight together regardless of which one is
 *   "active" in the room.
 * - `BATTLE_ROSTERS`: each war-eligible country's opposing lineup.
 *
 * Canada's roster started as the six people named when this feature was designed — five
 * real Canadian officials (satirizing their public "elbows up" / tariff-fight posture,
 * same spirit as the rest of the game's real-name cast, GAME_PLAN §14) plus one
 * deliberately fictional wildcard — then grew to seven when Jagmeet Singh joined
 * alongside a full re-crop of Carney/Trudeau/LeBlanc's own art from a newer reference
 * sheet (`public/assets/sprites/source/`, user-supplied). Joly and the fictional wildcard
 * got the same front/back re-crop in a later round, from their own user-supplied
 * reference sheets — see this file's per-unit comments for the wildcard's rename that
 * came with its new art. `data/battlefield.ts`'s `ENEMY_SPAWN_POSITIONS` was extended to
 * 7 slots to match Singh joining. Greenland's is generic (polar bears, not people) for the same
 * reason it was picked as a launch target: no live real-world conflict, easy to laugh
 * at — it later grew a fifth, non-bear unit (a seal) once the user supplied real bear
 * and seal reference art (previously all four bears were flat-color placeholders); the
 * same bear art is shared by all four bear entries (including the boss, which only
 * differs in stats) since the reference sheet only has the one animal. Panama and
 * Mexico use invented, clearly-fictional stand-ins rather than real officials, since
 * nobody asked for those specifically.
 *
 * A handful of named units also carry a personal combat quirk or a small Magic (MP)
 * pool on top of the plain stats below (Trump's cowardly flee chance, Vance hitting
 * himself, Miller backstabbing his own team, LeBlanc's dodge chance, Trudeau healing
 * from Melania's hits, Carney's Charm and Melania's Sorcerer magic) — see
 * `engine/battle.ts`'s doc comment and `attack()` for what each one actually does.
 *
 * **Canada's `maxComposure` values were halved in a balance pass** (user feedback: "it's
 * almost impossible to win a battle against Canada"), backed by a real simulator
 * (`scripts/simulateBattle.ts`, same Monte-Carlo shape as `scripts/simulate.ts`) rather
 * than a guess. It ran 2000 US-vs-country battles per country with a fair, identical AI
 * on both sides and found every other roster (3-4 units) already loses to the US's fixed
 * 6-unit cabinet 94-100% of the time — but Canada, uniquely, has *7* units, which under
 * `createBattle`'s interleaved turn order means Canada gets one extra, completely
 * unanswered action every round, forever. That structural edge alone (confirmed by
 * simulating a hypothetical 6-unit Canada with its stats untouched, ~19% US win rate)
 * was already brutal, and combined with Canada's per-unit stats made the real 7-unit
 * roster a mathematical lock for the enemy: 0.0% US win rate across 2000 battles.
 * Halving every unit's `maxComposure` (chosen over dropping a unit, since all 7 are
 * deliberately-added named officials, GAME_PLAN §14) brought that up to a still
 * genuinely-hard-but-winnable ~44% — the lowest of any war target by a wide margin, so
 * Canada stays the hardest fight in the game on purpose, it's just no longer a literal
 * lock. The relative "Low/High/Really high HP" comments below are still accurate after a
 * uniform halving (it preserves the ordering), so they weren't rewritten.
 *
 * Iran, Venezuela and Russia are new war targets, but — unlike Canada — all three are
 * currently in live, serious real-world conflicts or tensions with the US. Rather than
 * put a real, currently-serving head of state into a "defeat this person" minigame,
 * their rosters are invented archetypes (a spokesperson, a TV anchor, "a guy with a
 * megaphone"), matching the "sugar shack guy" spirit rather than any real person.
 * They're also war-only, not purchasable — that joke doesn't fit these three.
 *
 * **Exception: Russia's and Iran's rosters were later replaced with real/named units
 * once real sprite art existed for them.** For Russia, the user supplied a reference
 * sheet for Putin, Gorbachev and Yeltsin and asked for them to be wired in; told this
 * collided with the currently-serving-head-of-state rule above (Putin specifically —
 * Gorbachev and Yeltsin are both deceased former leaders, not implicated by it), the
 * user's explicit answer was "use him anyway" — overriding the rule for Russia only, on
 * the strength of having real art. For Iran, the same question came up independently
 * over a different reference sheet (a Khamenei-like Supreme Leader plus two generic
 * archetypes) and got the same answer for the same reason (Khamenei is Iran's actual
 * currently-serving Supreme Leader). Each override was asked for and granted per
 * country, not as a blanket policy change — Venezuela keeps its invented archetypes,
 * and neither Russia's nor Iran's own override generalizes further without the same
 * real-art trigger and the same explicit ask.
 *
 * **Backed by `data/characters/*.json`, not hardcoded object literals.** User request:
 * "Each character's information should also be in a json file" — the same treatment
 * `data/battlegrounds.ts` already got for map layouts. Asked how to scope it (merge with
 * `characters.ts`'s display data, or keep the two systems separate but both JSON), the
 * user chose the merge: `data/characters/us.json` holds each US official's *entire*
 * profile — name/short/placeholder/sprite (what `characters.ts` reads back out) *and*
 * move/range/power/maxComposure/quirks/magic (what this file reads back out) — one file
 * per side instead of two hand-maintained TypeScript files that had to be kept in sync by
 * eye. `data/characters/<country>.json` holds each country's enemy roster the same way
 * (already everything in one place, `nameKey`/stats/`sprite`/quirks together). This file's
 * own doc comment above — every design decision about who's on which roster, why, and what
 * quirk each unit has — describes the *content* these JSON files hold; nothing about that
 * content changed, only where it lives. `loadUsUnit`/`loadEnemyUnit`/`loadRoster` below
 * validate each file's shape at import time (same "fail loudly, name the exact bad field"
 * philosophy as `data/battlegrounds.ts`'s `parseGrid`), and still call
 * `getCharacter(id).sprite` from `characters.ts` for a US official's sprite — the one piece
 * of `us.json` this file doesn't re-parse itself, since `characters.ts` already did.
 */

const CHARACTER_IDS: ReadonlySet<CharacterId> = new Set<CharacterId>([
  'trump',
  'vance',
  'bessent',
  'lutnick',
  'melania',
  'musk',
]);

const MAGIC_KINDS: ReadonlySet<BattleMagicKind> = new Set<BattleMagicKind>(['charm', 'sorcerer']);

/** Every message key ever defined, for validating a `"nameKey"` against `src/i18n/en.ts`
 * at load time — a typo'd or renamed key would otherwise surface as a raw `MessageKey`
 * string on screen (i18n's own lookup has no other fallback), not a load-time crash. */
const MESSAGE_KEYS: ReadonlySet<string> = new Set(Object.keys(en));

/** Loosely-typed shape every raw JSON unit object is expected to have before validation —
 * see `data/battlegrounds.ts`'s `RawBattlegroundData` for the same pattern. */
interface RawUnit {
  readonly id?: unknown;
  readonly nameKey?: unknown;
  readonly move?: unknown;
  readonly range?: unknown;
  readonly power?: unknown;
  readonly maxComposure?: unknown;
  readonly placeholder?: unknown;
  readonly sprite?: unknown;
  readonly fleeChance?: unknown;
  readonly selfHitChance?: unknown;
  readonly backstabChance?: unknown;
  readonly dodgeChance?: unknown;
  readonly isWoman?: unknown;
  readonly healsFromWomen?: unknown;
  readonly magic?: unknown;
}

function asRawUnit(raw: unknown, label: string): RawUnit {
  if (raw === null || typeof raw !== 'object') {
    throw new Error(`${label}: expected a character object, got ${JSON.stringify(raw)}`);
  }
  return raw as RawUnit;
}

function parseCharacterId(raw: unknown, label: string): CharacterId {
  if (typeof raw !== 'string' || !CHARACTER_IDS.has(raw as CharacterId)) {
    throw new Error(`${label}: "${raw}" is not a known CharacterId (see engine/types.ts)`);
  }
  return raw as CharacterId;
}

function parseUnitId(raw: unknown, label: string): string {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new Error(`${label}: expected a non-empty string, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

function parseNameKey(raw: unknown, label: string): MessageKey {
  if (typeof raw !== 'string' || !MESSAGE_KEYS.has(raw)) {
    throw new Error(
      `${label}: "${raw}" is not a known message key — add it to src/i18n/en.ts (and fr.ts) first`,
    );
  }
  return raw as MessageKey;
}

function parsePositiveNumber(raw: unknown, label: string): number {
  if (typeof raw !== 'number' || !(raw > 0)) {
    throw new Error(`${label}: expected a positive number, got ${JSON.stringify(raw)}`);
  }
  return raw;
}

/** A quirk/magic probability — checked against `(0, 1]` at load time, the same invariant
 * `battleRosters.test.ts` already asserted about the resulting data, just caught earlier
 * and with a more specific error. */
function parseChance(raw: unknown, label: string): number {
  if (typeof raw !== 'number' || !(raw > 0 && raw <= 1)) {
    throw new Error(
      `${label}: expected a probability greater than 0 and at most 1, got ${JSON.stringify(raw)}`,
    );
  }
  return raw;
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

/** Unlike `characters.ts`'s `CharacterSprite` (all 4 poses required, every US official has
 * full art), only `front` is required here — a handful of enemy units only ever got
 * front/back or front-only reference art (see this file's top doc comment: Singh, the
 * Greenland bears/seal). */
function parseUnitSprite(raw: unknown, label: string): BattleUnitSprite {
  const obj = raw as { front?: unknown; back?: unknown; left?: unknown; right?: unknown } | null;
  if (obj === null || typeof obj !== 'object' || typeof obj.front !== 'string') {
    throw new Error(`${label}: expected at least {"front": string}, got ${JSON.stringify(raw)}`);
  }
  const sprite: { front: string; back?: string; left?: string; right?: string } = {
    front: obj.front,
  };
  for (const pose of ['back', 'left', 'right'] as const) {
    const value = obj[pose];
    if (value === undefined) continue;
    if (typeof value !== 'string') {
      throw new Error(`${label}.${pose}: expected a string path, got ${JSON.stringify(value)}`);
    }
    sprite[pose] = value;
  }
  return sprite;
}

function parseMagic(raw: unknown, label: string): BattleMagic {
  const obj = raw as { kind?: unknown; max?: unknown; chance?: unknown } | null;
  if (obj === null || typeof obj !== 'object') {
    throw new Error(`${label}: expected {"kind", "max", "chance"}, got ${JSON.stringify(raw)}`);
  }
  if (typeof obj.kind !== 'string' || !MAGIC_KINDS.has(obj.kind as BattleMagicKind)) {
    throw new Error(
      `${label} "kind": "${obj.kind}" must be one of: ${[...MAGIC_KINDS].join(', ')}`,
    );
  }
  if (typeof obj.max !== 'number' || !Number.isInteger(obj.max) || obj.max < 0) {
    throw new Error(
      `${label} "max": expected a non-negative integer, got ${JSON.stringify(obj.max)}`,
    );
  }
  const chance = parseChance(obj.chance, `${label} "chance"`);
  return { kind: obj.kind as BattleMagicKind, max: obj.max, chance };
}

/** Personal quirks are all optional and independent of each other (see `BattleUnitTemplate`'s
 * own doc comment in `engine/battle.ts` for which ones are meant to be mutually exclusive by
 * convention — that's a gameplay rule, not something this loader enforces). */
function parseQuirks(
  obj: RawUnit,
  label: string,
): Pick<
  BattleUnitTemplate,
  | 'fleeChance'
  | 'selfHitChance'
  | 'backstabChance'
  | 'dodgeChance'
  | 'isWoman'
  | 'healsFromWomen'
  | 'magic'
> {
  const quirks: {
    fleeChance?: number;
    selfHitChance?: number;
    backstabChance?: number;
    dodgeChance?: number;
    isWoman?: boolean;
    healsFromWomen?: boolean;
    magic?: BattleMagic;
  } = {};
  for (const key of ['fleeChance', 'selfHitChance', 'backstabChance', 'dodgeChance'] as const) {
    const value = obj[key];
    if (value !== undefined) quirks[key] = parseChance(value, `${label} "${key}"`);
  }
  for (const key of ['isWoman', 'healsFromWomen'] as const) {
    const value = obj[key];
    if (value !== undefined) {
      if (typeof value !== 'boolean') {
        throw new Error(`${label} "${key}": expected a boolean, got ${JSON.stringify(value)}`);
      }
      quirks[key] = value;
    }
  }
  if (obj.magic !== undefined) quirks.magic = parseMagic(obj.magic, `${label} "magic"`);
  return quirks;
}

function loadUsUnit(raw: unknown, label: string): BattleUnitTemplate {
  const obj = asRawUnit(raw, label);
  const id = parseCharacterId(obj.id, `${label} "id"`);
  return {
    id,
    move: parsePositiveNumber(obj.move, `${label} "move"`),
    range: parsePositiveNumber(obj.range, `${label} "range"`),
    power: parsePositiveNumber(obj.power, `${label} "power"`),
    maxComposure: parsePositiveNumber(obj.maxComposure, `${label} "maxComposure"`),
    placeholder: parsePlaceholder(obj.placeholder, `${label} "placeholder"`),
    // Reused from characters.ts, not re-parsed from this same JSON file a second time —
    // see this file's top doc comment.
    sprite: getCharacter(id).sprite,
    ...parseQuirks(obj, label),
  };
}

function loadEnemyUnit(raw: unknown, label: string): BattleUnitTemplate {
  const obj = asRawUnit(raw, label);
  const sprite =
    obj.sprite === undefined ? undefined : parseUnitSprite(obj.sprite, `${label} "sprite"`);
  return {
    id: parseUnitId(obj.id, `${label} "id"`),
    nameKey: parseNameKey(obj.nameKey, `${label} "nameKey"`),
    move: parsePositiveNumber(obj.move, `${label} "move"`),
    range: parsePositiveNumber(obj.range, `${label} "range"`),
    power: parsePositiveNumber(obj.power, `${label} "power"`),
    maxComposure: parsePositiveNumber(obj.maxComposure, `${label} "maxComposure"`),
    placeholder: parsePlaceholder(obj.placeholder, `${label} "placeholder"`),
    ...(sprite !== undefined ? { sprite } : {}),
    ...parseQuirks(obj, label),
  };
}

// Exported (like data/battlegrounds.ts's own loader) so tests can exercise the JSON
// validation directly with synthetic bad input, not only via the real committed files.
export function loadRoster(raw: unknown, country: CountryId): readonly BattleUnitTemplate[] {
  const label = `characters/${country}.json`;
  if (!Array.isArray(raw)) throw new Error(`${label}: expected an array, got ${typeof raw}`);
  return raw.map((entry, i) => loadEnemyUnit(entry, `${label}[${i}]`));
}

export function loadUsUnits(raw: unknown): Readonly<Record<CharacterId, BattleUnitTemplate>> {
  const label = 'characters/us.json';
  if (!Array.isArray(raw)) throw new Error(`${label}: expected an array, got ${typeof raw}`);
  const byId: Partial<Record<CharacterId, BattleUnitTemplate>> = {};
  raw.forEach((entry, i) => {
    const unit = loadUsUnit(entry, `${label}[${i}]`);
    // unit.id is typed as plain `string` on BattleUnitTemplate (it's shared with enemy
    // units, whose ids aren't a closed CharacterId union) — loadUsUnit only ever produces
    // one of the 6 known CharacterIds, though, so this cast is safe.
    byId[unit.id as CharacterId] = unit;
  });
  for (const id of CHARACTER_IDS) {
    if (byId[id] === undefined) {
      throw new Error(`${label}: missing an entry for character "${id}"`);
    }
  }
  return byId as Readonly<Record<CharacterId, BattleUnitTemplate>>;
}

export const US_BATTLE_UNITS: Readonly<Record<CharacterId, BattleUnitTemplate>> =
  loadUsUnits(usData);

export const BATTLE_ROSTERS: Readonly<Record<CountryId, readonly BattleUnitTemplate[]>> = {
  canada: loadRoster(canadaData, 'canada'),
  greenland: loadRoster(greenlandData, 'greenland'),
  panama: loadRoster(panamaData, 'panama'),
  mexico: loadRoster(mexicoData, 'mexico'),
  iran: loadRoster(iranData, 'iran'),
  venezuela: loadRoster(venezuelaData, 'venezuela'),
  russia: loadRoster(russiaData, 'russia'),
};

export function getBattleRoster(country: CountryId): readonly BattleUnitTemplate[] {
  return BATTLE_ROSTERS[country];
}
