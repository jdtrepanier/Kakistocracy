import type { CountryId } from '@/engine/types';
import type { Rng } from '@/engine/rng';
import type { MessageKey } from '@/i18n/en';

/**
 * World Map menu targets (GAME_PLAN §10). `declare_war` and `buy_country` don't ask the
 * player to pick a target — there's no target-selection UI in the plan — they pick a
 * random eligible country from here via the seeded RNG when they resolve. Declaring war
 * additionally plays out as a tactical battle (GAME_PLAN §7.1, `engine/battle.ts`)
 * against that country's roster (`data/battleRosters.ts`) before the target actually
 * sticks. The original four keep clear of any live real-world conflict (GAME_PLAN
 * §19.A); Iran/Venezuela/Russia are war-only and use invented, non-real-person rosters
 * for the same reason (see `data/battleRosters.ts`'s doc comment).
 */
export interface CountryDef {
  readonly id: CountryId;
  readonly nameKey: MessageKey;
  /** Eligible as a `declare_war` target (and thus a tactical-battle opponent). */
  readonly warTarget: boolean;
  /** Eligible as a `buy_country` target. */
  readonly purchasable: boolean;
  /** Placeholder marker position on the World Map screen, percent of the map box. */
  readonly mapX: number;
  readonly mapY: number;
}

export const COUNTRIES: readonly CountryDef[] = [
  {
    id: 'canada',
    nameKey: 'country.canada',
    warTarget: true,
    purchasable: true,
    mapX: 22,
    mapY: 20,
  },
  {
    id: 'greenland',
    nameKey: 'country.greenland',
    warTarget: true,
    purchasable: true,
    mapX: 46,
    mapY: 8,
  },
  {
    id: 'panama',
    nameKey: 'country.panama',
    warTarget: true,
    purchasable: true,
    mapX: 24,
    mapY: 58,
  },
  {
    id: 'mexico',
    nameKey: 'country.mexico',
    warTarget: true,
    purchasable: false,
    mapX: 18,
    mapY: 42,
  },
  { id: 'iran', nameKey: 'country.iran', warTarget: true, purchasable: false, mapX: 66, mapY: 38 },
  {
    id: 'venezuela',
    nameKey: 'country.venezuela',
    warTarget: true,
    purchasable: false,
    mapX: 28,
    mapY: 66,
  },
  {
    id: 'russia',
    nameKey: 'country.russia',
    warTarget: true,
    purchasable: false,
    mapX: 72,
    mapY: 12,
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
