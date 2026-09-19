import type { LandmarkId } from '@/engine/types';
import type { Rng } from '@/engine/rng';
import type { MessageKey } from '@/i18n/en';

/**
 * `rename_landmark` targets (GAME_PLAN §9/§10 "World Map menu"), picked from the same
 * World Map as Declare War/Buy a Country rather than resolved instantly (real user
 * feedback: "it would be nice to be able to select what you want to rename on the map" —
 * the same ask, and the same fix shape, `declare_war` already got earlier: see
 * `data/countries.ts`'s doc comment and `ui/screens/SelectCountryScreen.tsx`).
 *
 * All 7 are real, recognizable US landmarks — same "real names, satirical situations"
 * spirit as the rest of the game's cast (GAME_PLAN §14) and a direct riff on the actual
 * Gulf of Mexico/Mount McKinley renamings this game is already built to reference
 * (GAME_PLAN's "ripped from the headlines" list). `renamedKey` is a full authored phrase
 * per landmark rather than composed from parts at render time (e.g. `kind` + "America") —
 * this project's i18n convention is whole-phrase keys per language (never string
 * concatenation across `en.ts`/`fr.ts`, since the grammar doesn't line up the same way in
 * both), and the user's own examples ("Lake America", "Gulf of America", "Ocean America")
 * already show the pattern isn't perfectly uniform (Gulf keeps "of", Lake/Ocean don't), so
 * a template would need per-kind exceptions anyway — a plain authored string per landmark
 * is simpler and exactly as flexible.
 */
export interface LandmarkDef {
  readonly id: LandmarkId;
  /** Original, real-world name. */
  readonly nameKey: MessageKey;
  /** What it's called once renamed — always ending in "America" (user request), but
   * keeping each landmark's own descriptive word ("Gulf of America", "Mount America",
   * "Lake America"), not just the bare word "America" on its own. */
  readonly renamedKey: MessageKey;
  /**
   * Marker position on the World Map / target-select screens, percent of the map box —
   * same convention as `CountryDef.mapX`/`mapY` (tuned by eye against
   * `public/assets/maps/world-map.png`, not surveyed coordinates).
   */
  readonly mapX: number;
  readonly mapY: number;
}

// Coordinates re-tuned after a user report ("The landmark position of the map are off").
// The original values were plausible-looking guesses that didn't actually line up with
// `world-map.png`'s real coastlines once checked — e.g. `pacificOcean` landed on Baja
// California/mainland Mexico instead of open water, `denali` sat off the edge of the
// Alaska landmass, and `grandCanyon`/`mississippiRiver`/`lakeMichigan`/`niagaraFalls` were
// bunched close enough to nearly overlap. Re-derived by rendering candidate dots directly
// onto the actual map image (pixel-gridded crops of the Alaska and continental-US regions)
// and adjusting against real US geography until each dot sat in its real location, the
// same "tuned by eye against the actual asset" method this file's own doc comment
// prescribes — just actually checked against the image this time instead of estimated.
export const LANDMARKS: readonly LandmarkDef[] = [
  {
    id: 'gulfOfMexico',
    nameKey: 'landmark.gulfOfMexico.name',
    renamedKey: 'landmark.gulfOfMexico.renamed',
    mapX: 26,
    mapY: 61,
  },
  {
    id: 'denali',
    nameKey: 'landmark.denali.name',
    renamedKey: 'landmark.denali.renamed',
    mapX: 11,
    mapY: 23,
  },
  {
    id: 'niagaraFalls',
    nameKey: 'landmark.niagaraFalls.name',
    renamedKey: 'landmark.niagaraFalls.renamed',
    mapX: 32,
    mapY: 40,
  },
  {
    id: 'grandCanyon',
    nameKey: 'landmark.grandCanyon.name',
    renamedKey: 'landmark.grandCanyon.renamed',
    mapX: 20,
    mapY: 51,
  },
  {
    id: 'lakeMichigan',
    nameKey: 'landmark.lakeMichigan.name',
    renamedKey: 'landmark.lakeMichigan.renamed',
    mapX: 28,
    mapY: 41,
  },
  {
    id: 'pacificOcean',
    nameKey: 'landmark.pacificOcean.name',
    renamedKey: 'landmark.pacificOcean.renamed',
    mapX: 9,
    mapY: 47,
  },
  {
    id: 'mississippiRiver',
    nameKey: 'landmark.mississippiRiver.name',
    renamedKey: 'landmark.mississippiRiver.renamed',
    mapX: 25,
    mapY: 55,
  },
];

export function getLandmark(id: LandmarkId): LandmarkDef {
  const landmark = LANDMARKS.find((l) => l.id === id);
  if (!landmark) throw new Error(`Unknown landmark: ${id}`);
  return landmark;
}

/**
 * Picks a random landmark not already in `taken`, or `null` if every one has already
 * been renamed (same "you've run out" joke as `data/countries.ts`'s `pickRandomCountry`,
 * which this mirrors exactly — shared by `engine/effects.ts`'s random-target effect and
 * the picker screen's own eligibility check).
 */
export function pickRandomLandmark(taken: readonly LandmarkId[], rng: Rng): LandmarkId | null {
  const candidates = LANDMARKS.filter((l) => !taken.includes(l.id));
  return candidates.length === 0 ? null : rng.pick(candidates).id;
}

/** Only `rename_landmark` currently asks the player to pick a target on the World Map —
 * mirrors `engine/battle.ts`'s `actionHasBattle`. */
export function actionHasLandmark(actionId: string): boolean {
  return actionId === 'rename_landmark';
}
