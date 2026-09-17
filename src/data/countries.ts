import type { CountryId } from '@/engine/types';
import type { Rng } from '@/engine/rng';
import type { MessageKey } from '@/i18n/en';

/**
 * World Map menu targets (GAME_PLAN §10). `buy_country` still picks a random eligible
 * country via the seeded RNG when it resolves. `declare_war` used to as well, but now
 * asks the player to pick from the eligible list first (`store/gameStore.ts`'s
 * `selectBattleCountry`, rendered by `ui/screens/SelectCountryScreen.tsx`) — real user
 * feedback ("you should be able to select your country to attack") — and only then
 * plays out as a tactical battle (GAME_PLAN §7.1, `engine/battle.ts`) against that
 * country's roster (`data/battleRosters.ts`). The original four keep clear of any live
 * real-world conflict (GAME_PLAN §19.A); Iran/Venezuela/Russia are war-only and use
 * invented, non-real-person rosters for the same reason (see `data/battleRosters.ts`'s
 * doc comment).
 */
export interface CountryDef {
  readonly id: CountryId;
  readonly nameKey: MessageKey;
  /** Eligible as a `declare_war` target (and thus a tactical-battle opponent). */
  readonly warTarget: boolean;
  /** Eligible as a `buy_country` target. */
  readonly purchasable: boolean;
  /**
   * Marker position on the World Map / target-select screens, percent of the map box.
   * Tuned by eye against the real world-map background image
   * (`public/assets/maps/world-map.png`, `styles/room.css`'s `.map-world`) — close to
   * each country's actual location on that specific image crop, not surveyed
   * coordinates, which is plenty for a marker meant to sit "roughly on the country."
   */
  readonly mapX: number;
  readonly mapY: number;
  /**
   * Placeholder "country logo" color for the small oval pastille under each unit's
   * token in `ui/battle/BattleView.tsx` (user feedback: a badge under the character
   * reads better than the box-shadow rectangle it used to draw around the whole
   * sprite). Used to be a Unicode flag emoji instead of a color — dropped after
   * real user feedback showed it rendering as plain "CA"-style two-letter text
   * instead of a flag picture (Windows' emoji font deliberately renders many flag
   * emoji as country-code text, unlike macOS/Android — not a bug in this app, just an
   * unreliable glyph to depend on). A plain color hits the same "which country" read
   * without needing any font to cooperate; a real crest/logo asset per country would
   * replace this the same way real sprites replaced the colored-square placeholders —
   * same spirit, see `CLAUDE.md`'s placeholder-art convention.
   */
  readonly color: string;
}

/** The player's own side badge (`BattleUnitToken`'s pastille for `side: 'us'` units) —
 * not a `CountryDef` since the US is never a `CountryId` (it's the player, not a World
 * Map target), so it lives here as its own constant instead of an eighth roster entry. */
export const US_COLOR = '#3a6ea5';

export const COUNTRIES: readonly CountryDef[] = [
  {
    id: 'canada',
    nameKey: 'country.canada',
    warTarget: true,
    purchasable: true,
    mapX: 18,
    mapY: 30,
    color: '#c8323c',
  },
  {
    id: 'greenland',
    nameKey: 'country.greenland',
    warTarget: true,
    purchasable: true,
    mapX: 38,
    mapY: 14,
    color: '#7fb8d9',
  },
  {
    id: 'panama',
    nameKey: 'country.panama',
    warTarget: true,
    purchasable: true,
    mapX: 23,
    mapY: 68,
    color: '#b7422f',
  },
  {
    id: 'mexico',
    nameKey: 'country.mexico',
    warTarget: true,
    purchasable: false,
    mapX: 21,
    mapY: 60,
    color: '#2f8f4e',
  },
  {
    id: 'iran',
    nameKey: 'country.iran',
    warTarget: true,
    purchasable: false,
    mapX: 71,
    mapY: 45,
    color: '#4a7c59',
  },
  {
    id: 'venezuela',
    nameKey: 'country.venezuela',
    warTarget: true,
    purchasable: false,
    mapX: 25,
    mapY: 74,
    color: '#d9a83a',
  },
  {
    id: 'russia',
    nameKey: 'country.russia',
    warTarget: true,
    purchasable: false,
    mapX: 78,
    mapY: 24,
    color: '#2f4d80',
  },
];

export function getCountry(id: CountryId): CountryDef {
  const country = COUNTRIES.find((c) => c.id === id);
  if (!country) throw new Error(`Unknown country: ${id}`);
  return country;
}

/**
 * Picks a random country matching `eligible` that isn't already in `taken`, or `null` if
 * every eligible country has already been hit (the joke: you've run out of countries).
 * Shared by `engine/effects.ts`'s random-target effects and the battle flow's up-front
 * target pick, so both agree on what "eligible" means.
 */
export function pickRandomCountry(
  taken: readonly CountryId[],
  eligible: (country: CountryDef) => boolean,
  rng: Rng,
): CountryId | null {
  const candidates = COUNTRIES.filter((c) => eligible(c) && !taken.includes(c.id));
  return candidates.length === 0 ? null : rng.pick(candidates).id;
}
