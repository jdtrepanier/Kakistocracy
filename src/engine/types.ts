/**
 * Core game types. Pure data: no React, no DOM.
 * See docs/GAME_PLAN.md §4 (HUD), §5 (endings) and §15 (core types).
 */

export type CharacterId = 'trump' | 'vance' | 'bessent' | 'lutnick' | 'melania' | 'musk';

/** World Map targets (GAME_PLAN §10 "World Map menu"). See `data/countries.ts`. */
export type CountryId =
  | 'canada'
  | 'greenland'
  | 'panama'
  | 'mexico'
  | 'iran'
  | 'venezuela'
  | 'russia';

/** `rename_landmark` targets, picked on the same World Map (GAME_PLAN §10). See
 * `data/landmarks.ts`. */
export type LandmarkId =
  | 'gulfOfMexico'
  | 'denali'
  | 'niagaraFalls'
  | 'grandCanyon'
  | 'lakeMichigan'
  | 'pacificOcean'
  | 'mississippiRiver';

/** Collectible flavor items (real user feedback: "the can of meat should stay in your
 * items" — the opening cutscene's can was purely narrative before this, never added to
 * any real state — "you can also put an autopen item somewhere else that you can grab").
 * Pure flavor/collectibles, not a mechanic: nothing in the effect DSL reads `items`, the
 * same "reserved, no consumer yet" spirit this file already has for a few flag names. See
 * `data/items.ts`. */
export type ItemId = 'can-of-meat' | 'autopen';

/** A month on the game calendar. `month` is 1–12. */
export interface GameDate {
  readonly year: number;
  readonly month: number;
}

export type StatKey =
  | 'debt' // trillions of dollars
  | 'interestRate' // percent
  | 'inflation' // official, percent
  | 'feltInflation' // what people feel — drives Happiness/hyperinflation — percent
  | 'iq' // Party IQ
  | 'happiness' // percent
  | 'defcon' // 5 = calm … 1 = Nuclear Meltdown
  | 'headlines'; // score

export type NationStats = Readonly<Record<StatKey, number>>;

/** Building blocks for action, event and showdown outcomes. */
export type Effect =
  | { readonly kind: 'delta'; readonly stat: StatKey; readonly amount: number }
  | {
      readonly kind: 'spread';
      readonly stat: StatKey;
      readonly amount: number;
      readonly months: number;
    }
  | {
      readonly kind: 'delayed';
      readonly stat: StatKey;
      readonly amount: number;
      readonly inMonths: number;
    }
  | {
      readonly kind: 'chance';
      readonly p: number;
      readonly then: readonly Effect[];
      readonly else?: readonly Effect[];
    }
  | { readonly kind: 'flag'; readonly set: string }
  /** Removes a previously-set flag, if present (a no-op otherwise). The DSL's only way to
   * undo a `flag` effect — used by Elon's reconciliation (GAME_PLAN §8) to clear
   * `elonLeftCabinet` once he's back in the cabinet. */
  | { readonly kind: 'unflag'; readonly clear: string }
  /** Elon's Rage Quit meter (GAME_PLAN §8): fills from actions/events he dislikes (big
   * spending, tariffs on his suppliers), clamped 0–100 by `applyEffect`. At 100,
   * `checkElonRage` sets the `elonLeftCabinet` flag — see that function's doc comment. */
  | { readonly kind: 'rage'; readonly amount: number }
  /** Picks a random not-yet-warred country (GAME_PLAN §9/§10) and adds it to `atWarWith`.
   * Superseded for `declare_war` itself by the tactical battle (GAME_PLAN §7.1), which
   * picks the country up front and applies `declareWarOn` instead — this kind is kept for
   * any other action or event that wants an instant, battle-free war declaration. */
  | { readonly kind: 'declareWar' }
  /** Adds a specific, already-chosen country to `atWarWith` (idempotent). Used by the
   * tactical battle flow, which knows the target before the roll (see `engine/battle.ts`). */
  | { readonly kind: 'declareWarOn'; readonly country: CountryId }
  /** Picks a random not-yet-owned purchasable country and adds it to `countriesOwned`. */
  | { readonly kind: 'purchaseCountry' }
  /** Picks a random not-yet-renamed landmark and adds it to `renamedLandmarks` (GAME_PLAN
   * §9/§10, `rename_landmark`) — same "instant, no target picked" shape as `declareWar`,
   * used as the graceful-degradation fallback once every landmark is already renamed (see
   * `store/gameStore.ts`'s `confirmPreview`). Superseded in the normal case by
   * `renameLandmarkOn`, substituted in once the player picks a landmark on the World Map
   * (real user feedback: "it would be nice to be able to select what you want to rename on
   * the map" — same ask, and the same fix shape, as `declareWar`/`declareWarOn` got
   * earlier for Declare War). */
  | { readonly kind: 'renameLandmark' }
  /** Adds a specific, already-picked landmark to `renamedLandmarks` (idempotent). */
  | { readonly kind: 'renameLandmarkOn'; readonly landmark: LandmarkId };

/** An effect waiting in the queue, applied at a future month-end. */
export interface PendingEffect {
  readonly stat: StatKey;
  readonly amount: number;
  readonly inMonths: number;
}

export type LossEnding =
  | 'bankruptcy'
  | 'revolt'
  | 'nuclear'
  | 'hyperinflation'
  | 'brainFreeze'
  | 'impeachment';

export type EndingId = LossEnding | 'survived';

/** One resolved action, kept for diminishing headlines and the impeachment check. */
export interface ActionLogEntry {
  readonly actionId: string;
  readonly date: GameDate;
  readonly success: boolean;
}

export interface GameState {
  /** Seed of the run, shown on the game-over screen so a run can be replayed. */
  readonly seed: number;
  /** Current RNG state; restore with `createRng(rngState)`. */
  readonly rngState: number;
  readonly date: GameDate;
  readonly stats: NationStats;
  /** Executive Actions left this month. */
  readonly actionsLeft: number;
  /**
   * Action ids already used this month, for `limit: 'oncePerMonth'` actions.
   * NOTE: Phase 1 has no character-selection UI yet, so "one action per official per
   * month" (GAME_PLAN §9) isn't enforced — only per-action monthly limits are. Revisit
   * once rooms and switching officials land in Phase 2.
   */
  readonly actionsUsedThisMonth: readonly string[];
  readonly pending: readonly PendingEffect[];
  readonly flags: readonly string[];
  /** Countries the `declareWar` effect has hit so far (GAME_PLAN "World Map menu"). */
  readonly atWarWith: readonly CountryId[];
  /** Countries the `purchaseCountry` effect has successfully bought. */
  readonly countriesOwned: readonly CountryId[];
  /** Landmarks the `renameLandmark`/`renameLandmarkOn` effect has renamed to "America" so
   * far (GAME_PLAN "World Map menu"). */
  readonly renamedLandmarks: readonly LandmarkId[];
  /** Every resolved action, oldest first. */
  readonly history: readonly ActionLogEntry[];
  /** DEFCON value at the start of the current month, for the "no escalation" recovery rule. */
  readonly defconMonthStart: number;
  /** Consecutive months DEFCON has not decreased (§6: 4 calm months → DEFCON +1). */
  readonly defconCalmStreak: number;
  /** Whether the midterms happiness check has already run (it only runs once). */
  readonly midtermsChecked: boolean;
  /** True once midterms are lost (Happiness below the midterm threshold at that check). */
  readonly congressLost: boolean;
  /** Consecutive month-ends with Happiness below the impeachment threshold, post-midterms. */
  readonly lowHappinessStreak: number;
  /** Elon's Rage Quit meter (GAME_PLAN §8), 0–100. See the `rage` `Effect` kind and
   * `checkElonRage` in `engine/effects.ts`. Not a `StatKey`/`NationStats` value: it's a
   * cabinet-member mechanic, not a national stat shown on the HUD. */
  readonly elonRage: number;
  /** Hidden geopolitical oil-market pressure (0 = neutral), driven only by the outcome of
   * a Declare-War-on-Iran battle (user feedback: "When you attack Iran, if you lose, huge
   * increase in oil price. You win, oil price goes down.") — see `engine/effects.ts`'s
   * `applyOilPriceShock` and `engine/economy.ts`'s monthly decay/feltInflation nudge. Not
   * a `StatKey`/`NationStats` value and never shown on the HUD (same "cabinet-adjacent
   * mechanic, not a national stat" category as `elonRage` above) — the player only ever
   * feels it through Felt Inflation drifting up (a loss) or easing (a win) over the
   * following months, never as a number of its own. */
  readonly oilPriceIndex: number;
  /** Collectible flavor items picked up so far (GAME_PLAN's opening cutscene and any
   * grabbable room item — see `ItemId`'s doc comment). Order is pickup order; duplicates
   * never occur (`grabItem` in `store/gameStore.ts` is idempotent). */
  readonly items: readonly ItemId[];
  readonly ending: EndingId | null;
}
