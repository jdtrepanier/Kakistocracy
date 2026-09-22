# Character JSON files

Every side has a file here — `us.json` (the 6 switchable officials) plus one file per
war-eligible country (`canada.json`, `greenland.json`, `panama.json`, `mexico.json`,
`iran.json`, `venezuela.json`, `russia.json`) — a hand-editable description of every
character's _entire_ profile: display info and combat stats together in one object per
character. `src/data/characters.ts` and `src/data/battleRosters.ts` load these files,
validate their shape, and turn them into what the game actually uses (name/HUD text,
sprites, and tactical-battle stats). You can edit these files directly with any text
editor — no code changes needed — and the game will pick up your changes the next time it
(re)loads. A mistake (an unknown message key, a stat that isn't a positive number, an
out-of-range quirk chance) throws a clear, specific error naming exactly which file and
field is wrong.

**Why one merged file per character, not two.** This data used to live in two separate
TypeScript files — `characters.ts` (name/short/placeholder/sprite for the US officials)
and `battleRosters.ts` (combat stats and quirks for every unit, US and enemy alike) — kept
in sync by hand. User request: _"Each character's information should also be in a json
file"_, and asked how to scope it, the explicit choice was to merge: everything about one
character belongs in one file, not two systems a person has to remember to update
together. `characters.ts` only reads the display fields back out of `us.json`;
`battleRosters.ts` reads the same file a second time for the stats/quirks (and still calls
`characters.ts`'s `getCharacter(id).sprite` for a US official's sprite, rather than parsing
it twice).

## `us.json` — the 6 switchable officials

An array of 6 objects (`trump`, `vance`, `bessent`, `lutnick`, `melania`, `musk` — must be
exactly these 6 ids, one each; the loader throws if one is missing or misspelled, since
`CharacterId` is a closed set defined in `engine/types.ts`, not something a JSON file can
grow on its own). Each object:

| Key                                                               | Type                                                                                      | Meaning                                                                                                 |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `id`                                                              | one of the 6 known ids                                                                    | Must match `engine/types.ts`'s `CharacterId` union exactly.                                             |
| `name`                                                            | `{ "real": string, "parody": string }`                                                    | Full display name in each `NameMode` (`characters.ts`'s `NAME_MODE` picks which one shows).             |
| `short`                                                           | `{ "real": string, "parody": string }`                                                    | ≤8-character HUD label in each mode.                                                                    |
| `placeholder`                                                     | `{ "initials": string, "color": string }`                                                 | Fallback rendering before/instead of sprite art.                                                        |
| `sprite`                                                          | `{ "front", "back", "left", "right" }`                                                    | All 4 required for a US official — every one has full reference art. Paths under `/assets/sprites/us/`. |
| `move`                                                            | positive number                                                                           | Tiles this unit can move per turn (battle only).                                                        |
| `range`                                                           | positive number                                                                           | Melee/attack range in tiles (every unit today is `1`).                                                  |
| `power`                                                           | positive number                                                                           | Base damage per hit.                                                                                    |
| `maxComposure`                                                    | positive number                                                                           | This unit's HP-equivalent.                                                                              |
| `fleeChance` / `selfHitChance` / `backstabChance` / `dodgeChance` | number in `(0, 1]`, optional                                                              | Personal combat quirk — see `engine/battle.ts`'s `attack()` doc comment for what each does.             |
| `isWoman`                                                         | boolean, optional                                                                         | Only ever checked on the _attacker_ (Trudeau's `healsFromWomen` below).                                 |
| `healsFromWomen`                                                  | boolean, optional                                                                         | Attacks from an `isWoman` unit heal instead of damage this unit.                                        |
| `magic`                                                           | `{ "kind": "charm"\|"sorcerer", "max": integer ≥0, "chance": number in (0,1] }`, optional | A charge-up spell — see `engine/battle.ts`'s `castCharm`/`castCurse`.                                   |

## `<country>.json` — that country's enemy roster

An array of that country's units, in `data/battleRosters.ts`'s `BATTLE_ROSTERS[country]`
order. Same shape as `us.json`'s entries, except:

- `id` is any non-empty string (not a closed set — enemy unit ids are just
  `"<country>-<name>"` strings, e.g. `"canada-carney"`), and must be unique across every
  roster (checked by `battleRosters.test.ts`, not the loader itself).
- `nameKey` (required, no `name`/`short` fields) — an i18n key that must already exist in
  `src/i18n/en.ts` (and therefore `fr.ts`, which TypeScript requires to have the exact same
  keys). The loader checks this against `en.ts` at load time; add the key there first if
  you're naming a brand-new unit.
- `sprite` is entirely optional (Panama/Mexico/Venezuela's invented archetypes have none —
  they render as `placeholder` only), and when present only `"front"` is required — a few
  units only ever got partial reference art (Jagmeet Singh: front only; Greenland's
  bears/seal: front+back, no side view).

## Gotchas

- **`us.json` must have exactly the 6 known officials, one each** — the loader throws if
  one is missing, duplicated, or misspelled. Adding a 7th switchable official isn't
  possible from JSON alone; `engine/types.ts`'s `CharacterId` union has to grow first.
- **A `nameKey` typo is caught at load time**, not silently rendered as a raw key string —
  but only if the key doesn't exist yet anywhere in `en.ts`. Renaming/removing a key that's
  still referenced here will also throw.
- **Quirk/magic chances must be `> 0` and `<= 1`** — a `0` chance quirk is pointless (just
  omit the field), and the loader rejects it rather than silently having no effect.
- **Every country's file is independent**, same as `data/battlegrounds/`'s files — editing
  `iran.json` can never affect another country's roster.
- **No visual editor for this data yet** (unlike `data/battlegrounds/`'s `mapeditor/`) —
  hand-edit these files with a text editor for now.
