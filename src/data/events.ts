import type { Effect } from '@/engine/types';
import type { MessageKey } from '@/i18n/en';

/**
 * Random monthly events (GAME_PLAN §13): `engine/events.ts`'s `rollMonthlyEvent` picks one
 * of these, weighted, at every month-end and applies its effects with the same DSL actions
 * use (`engine/effects.ts`'s `applyEffects`) — no parallel mini-language.
 *
 * Simplification (documented, not an oversight): GAME_PLAN says event weights "shift with
 * your stats." This vertical-slice pass uses flat weights plus optional flag-gating
 * (`requires.flags`) instead of a full stat-driven weighting model — good enough for "one
 * of ~20 random events a month," a fuller model is a Phase 5 refinement.
 */
export interface EventDef {
  readonly id: string;
  /** i18n key for the headline shown in the month report / ticker. */
  readonly nameKey: MessageKey;
  /** Relative weight in the random draw — bigger means more common. Not a percentage. */
  readonly weight: number;
  readonly effects: readonly Effect[];
  /** Only eligible once every one of these flags is set. */
  readonly requires?: { readonly flags?: readonly string[] };
  /**
   * Elon's sabotage events (GAME_PLAN §8): once his Rage Quit meter maxes out and he
   * storms out of the cabinet (`elonLeftCabinet`, set by `engine/effects.ts`'s
   * `checkElonRage`), these are the *only* events eligible to be drawn each month —
   * SpaceX/Starlink/DOGE-access mischief instead of the normal news cycle — until
   * `elon_reconciliation` (`data/actions.ts`) patches things up. See `eligibleEvents`.
   */
  readonly sabotage?: boolean;
}

export const EVENTS: readonly EventDef[] = [
  {
    id: 'egg_shortage',
    nameKey: 'event.eggShortage.name',
    weight: 10,
    effects: [{ kind: 'delta', stat: 'feltInflation', amount: 1 }],
  },
  {
    id: 'hurricane',
    nameKey: 'event.hurricane.name',
    // §13's "redirect it with the Sharpie, 10% success" mini-game is a later refinement —
    // for now it's a flat Happiness hit, like the game's other unmitigated random events.
    weight: 8,
    effects: [{ kind: 'delta', stat: 'happiness', amount: -3 }],
  },
  {
    id: 'market_melt_up',
    nameKey: 'event.marketMeltUp.name',
    weight: 8,
    effects: [{ kind: 'delta', stat: 'happiness', amount: 3 }],
  },
  {
    id: 'foreign_crisis',
    nameKey: 'event.foreignCrisis.name',
    weight: 6,
    effects: [{ kind: 'delta', stat: 'defcon', amount: -1 }],
  },
  {
    id: 'recession_scare',
    nameKey: 'event.recessionScare.name',
    weight: 6,
    effects: [
      { kind: 'delta', stat: 'debt', amount: 0.5 },
      { kind: 'delta', stat: 'happiness', amount: -5 },
    ],
  },
  {
    id: 'journalist_group_chat',
    nameKey: 'event.journalistGroupChat.name',
    // A full press-showdown replay is Phase 3's showdown scope, not this event system —
    // simplified to a coin flip between "big story" Headlines and a quiet Happiness dent.
    weight: 8,
    effects: [
      {
        kind: 'chance',
        p: 0.5,
        then: [{ kind: 'delta', stat: 'headlines', amount: 8 }],
        else: [{ kind: 'delta', stat: 'happiness', amount: -2 }],
      },
    ],
  },
  {
    id: 'doge_audit',
    nameKey: 'event.dogeAudit.name',
    weight: 6,
    effects: [
      { kind: 'delta', stat: 'debt', amount: 0.3 },
      { kind: 'delta', stat: 'iq', amount: -2 },
    ],
  },
  {
    id: 'bond_vigilantes',
    nameKey: 'event.bondVigilantes.name',
    weight: 6,
    effects: [{ kind: 'spread', stat: 'interestRate', amount: 0.9, months: 3 }],
  },
  {
    id: 'elon_posts_3am',
    nameKey: 'event.elonPosts3am.name',
    weight: 8,
    effects: [
      // Feeds Elon's Rage Quit meter (GAME_PLAN §8) — see `engine/effects.ts`'s `rage`
      // case and `checkElonRage`.
      { kind: 'rage', amount: 20 },
      { kind: 'delta', stat: 'headlines', amount: 5 },
    ],
  },
  {
    id: 'reactor_inspection',
    nameKey: 'event.reactorInspection.name',
    // Only eligible once DOGE has actually cut Energy (see the `dogeCutEnergy` flag on
    // `data/actions.ts`'s `doge_chainsaw`) — GAME_PLAN §13's "only after DOGE cuts Energy."
    weight: 3,
    requires: { flags: ['dogeCutEnergy'] },
    effects: [
      {
        kind: 'chance',
        p: 0.15,
        then: [{ kind: 'delta', stat: 'defcon', amount: -1 }],
        else: [{ kind: 'delta', stat: 'headlines', amount: 2 }],
      },
    ],
  },
  {
    id: 'taco_trade_meme',
    nameKey: 'event.tacoTradeMeme.name',
    weight: 8,
    effects: [
      { kind: 'delta', stat: 'happiness', amount: 2 },
      { kind: 'delta', stat: 'iq', amount: -1 },
    ],
  },
  {
    id: 'viral_dance_challenge',
    nameKey: 'event.viralDanceChallenge.name',
    weight: 9,
    effects: [
      { kind: 'delta', stat: 'happiness', amount: 2 },
      { kind: 'delta', stat: 'headlines', amount: 5 },
    ],
  },
  {
    id: 'debt_clock_glitch',
    nameKey: 'event.debtClockGlitch.name',
    weight: 9,
    effects: [{ kind: 'delta', stat: 'headlines', amount: 6 }],
  },
  {
    id: 'congressional_hearing',
    nameKey: 'event.congressionalHearing.name',
    weight: 7,
    effects: [{ kind: 'delta', stat: 'iq', amount: -3 }],
  },
  {
    id: 'approval_poll_leak',
    nameKey: 'event.approvalPollLeak.name',
    weight: 8,
    effects: [
      {
        kind: 'chance',
        p: 0.5,
        then: [{ kind: 'delta', stat: 'happiness', amount: 2 }],
        else: [{ kind: 'delta', stat: 'happiness', amount: -2 }],
      },
    ],
  },
  {
    id: 'crypto_rally',
    nameKey: 'event.cryptoRally.name',
    weight: 7,
    effects: [
      {
        kind: 'chance',
        p: 0.3,
        then: [{ kind: 'delta', stat: 'debt', amount: -0.2 }],
        else: [{ kind: 'delta', stat: 'feltInflation', amount: 0.3 }],
      },
    ],
  },
  {
    id: 'summit_invite',
    nameKey: 'event.summitInvite.name',
    weight: 7,
    effects: [{ kind: 'delta', stat: 'defcon', amount: 1 }],
  },
  {
    id: 'staff_shakeup',
    nameKey: 'event.staffShakeup.name',
    weight: 7,
    effects: [
      { kind: 'delta', stat: 'iq', amount: 2 },
      { kind: 'delta', stat: 'headlines', amount: 4 },
    ],
  },
  {
    id: 'tariff_retaliation',
    nameKey: 'event.tariffRetaliation.name',
    weight: 6,
    effects: [
      { kind: 'delta', stat: 'feltInflation', amount: 0.4 },
      { kind: 'delta', stat: 'happiness', amount: -1 },
    ],
  },
  {
    id: 'canada_joins_eu',
    nameKey: 'event.canadaJoinsEu.name',
    // Real weight class for a big, embarrassing geopolitical stunt — same tier as
    // `foreign_crisis`/`weather_balloon_panic`, rather than an everyday news-cycle item.
    // Not gated on anything: the war/purchase system tracks `atWarWith`/`countriesOwned`
    // (`engine/types.ts`), not a flag, so there's no existing hook to require "Canada is
    // at war" or "Canada owned" here without a bigger change to that system — this is a
    // flat random headline, same as `foreign_crisis` or `tariff_retaliation` above.
    weight: 5,
    effects: [
      { kind: 'delta', stat: 'headlines', amount: 12 },
      { kind: 'delta', stat: 'happiness', amount: -4 },
      { kind: 'delta', stat: 'defcon', amount: -1 },
    ],
  },
  {
    id: 'weather_balloon_panic',
    nameKey: 'event.weatherBalloonPanic.name',
    weight: 7,
    effects: [
      { kind: 'delta', stat: 'defcon', amount: -1 },
      { kind: 'delta', stat: 'headlines', amount: 8 },
    ],
  },
  {
    id: 'spacex_withdrawal',
    nameKey: 'event.spacexWithdrawal.name',
    sabotage: true,
    weight: 10,
    effects: [
      { kind: 'delta', stat: 'debt', amount: 0.4 },
      { kind: 'delta', stat: 'headlines', amount: 3 },
    ],
  },
  {
    id: 'starlink_outage',
    nameKey: 'event.starlinkOutage.name',
    sabotage: true,
    weight: 10,
    effects: [{ kind: 'delta', stat: 'happiness', amount: -4 }],
  },
  {
    id: 'doge_access_leak',
    nameKey: 'event.dogeAccessLeak.name',
    sabotage: true,
    weight: 10,
    effects: [
      { kind: 'delta', stat: 'iq', amount: -3 },
      { kind: 'delta', stat: 'headlines', amount: 6 },
    ],
  },
];

/**
 * Events currently eligible to be drawn, given the flags set so far (`requires.flags`)
 * and whether Elon has rage-quit the cabinet. While `elonLeftCabinet` is set, only his
 * sabotage events (`sabotage: true`) are eligible — the normal news cycle pauses until
 * `elon_reconciliation` clears the flag; otherwise sabotage events never come up.
 */
export function eligibleEvents(flags: readonly string[]): readonly EventDef[] {
  const gated = EVENTS.filter((e) => (e.requires?.flags ?? []).every((f) => flags.includes(f)));
  const enraged = flags.includes('elonLeftCabinet');
  return gated.filter((e) => Boolean(e.sabotage) === enraged);
}

export function getEvent(id: string): EventDef {
  const event = EVENTS.find((e) => e.id === id);
  if (!event) throw new Error(`Unknown event: ${id}`);
  return event;
}
