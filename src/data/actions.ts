import type { ActionDef } from '@/engine/actions';

/**
 * The Phase 1 action catalog (GAME_PLAN §9, first slice). No specialty/room bonuses yet
 * (Phase 2/3), no showdown dialogue (Phase 3) — a plain list of buttons, per the
 * "spreadsheet prototype" roadmap entry.
 */
export const ACTIONS: readonly ActionDef[] = [
  {
    id: 'declare_war',
    nameKey: 'action.declareWar.name',
    actors: ['trump'],
    room: 'situationRoom',
    cost: { ea: 2 },
    requires: { iqMax: 70 },
    baseSuccess: 60,
    onSuccess: [
      { kind: 'delta', stat: 'debt', amount: 1.5 },
      { kind: 'delta', stat: 'happiness', amount: 10 },
      { kind: 'delta', stat: 'iq', amount: -5 },
      { kind: 'delta', stat: 'defcon', amount: -2 },
      { kind: 'spread', stat: 'happiness', amount: -12, months: 12 },
      { kind: 'declareWar' },
    ],
    onFail: [
      { kind: 'delta', stat: 'iq', amount: -5 },
      { kind: 'delta', stat: 'defcon', amount: -1 },
      { kind: 'delta', stat: 'happiness', amount: -3 },
    ],
    headlines: 60,
  },
  {
    id: 'declare_war_object',
    nameKey: 'action.declareWarObject.name',
    actors: ['trump'],
    room: 'situationRoom',
    cost: { ea: 1 },
    requires: { iqMax: 50 },
    baseSuccess: 80,
    onSuccess: [{ kind: 'delta', stat: 'iq', amount: -10 }],
    onFail: [{ kind: 'delta', stat: 'iq', amount: -5 }],
    headlines: 90,
  },
  {
    id: 'impose_tariff',
    nameKey: 'action.imposeTariff.name',
    // Feeds Elon's Rage Quit meter (GAME_PLAN §8: "tariffs on his suppliers") — a small
    // amount each time, unlike Liberation Day's one-shot "everyone at once" spike below.
    actors: ['lutnick'],
    room: 'commerce',
    cost: { ea: 1 },
    baseSuccess: 75,
    onSuccess: [
      { kind: 'delta', stat: 'happiness', amount: -2 },
      { kind: 'spread', stat: 'debt', amount: -0.3, months: 3 },
      { kind: 'spread', stat: 'inflation', amount: 0.3, months: 3 },
      { kind: 'spread', stat: 'feltInflation', amount: 0.6, months: 3 },
      { kind: 'rage', amount: 8 },
    ],
    onFail: [{ kind: 'delta', stat: 'happiness', amount: -4 }],
    headlines: 30,
  },
  {
    id: 'rename_landmark',
    nameKey: 'action.renameLandmark.name',
    actors: ['trump'],
    room: 'mapRoom',
    cost: { ea: 1 },
    baseSuccess: 90,
    onSuccess: [
      { kind: 'delta', stat: 'iq', amount: -2 },
      {
        kind: 'chance',
        p: 0.5,
        then: [{ kind: 'delta', stat: 'happiness', amount: 1 }],
        else: [{ kind: 'delta', stat: 'happiness', amount: -1 }],
      },
    ],
    onFail: [{ kind: 'delta', stat: 'iq', amount: -1 }],
    headlines: 25,
  },
  {
    id: 'rename_department',
    nameKey: 'action.renameDepartment.name',
    actors: ['trump'],
    room: 'pentagon',
    cost: { ea: 1 },
    baseSuccess: 85,
    onSuccess: [
      { kind: 'delta', stat: 'iq', amount: -1 },
      { kind: 'delta', stat: 'debt', amount: 0.002 },
    ],
    onFail: [],
    headlines: 20,
  },
  {
    id: 'launch_rocket',
    nameKey: 'action.launchRocket.name',
    actors: ['musk'],
    // Solo-Musk actions go quiet while he's gone (GAME_PLAN §8's Rage Quit passive) —
    // see `data/actions.ts`'s `elon_reconciliation` for how he comes back.
    requires: { notFlags: ['elonLeftCabinet'] },
    room: 'starbase',
    cost: { ea: 1 },
    baseSuccess: 50,
    onSuccess: [{ kind: 'delta', stat: 'happiness', amount: 5 }],
    onFail: [
      { kind: 'delta', stat: 'debt', amount: 0.05 },
      { kind: 'delta', stat: 'happiness', amount: -2 },
    ],
    headlines: 35,
  },
  {
    id: 'stimulus_5000',
    nameKey: 'action.stimulus5000.name',
    actors: ['trump', 'bessent'],
    room: 'treasury',
    cost: { ea: 2 },
    baseSuccess: 90,
    onSuccess: [
      { kind: 'delta', stat: 'debt', amount: 1.7 },
      { kind: 'delta', stat: 'happiness', amount: 15 },
      { kind: 'spread', stat: 'inflation', amount: 1.5, months: 6 },
      { kind: 'spread', stat: 'feltInflation', amount: 2, months: 6 },
    ],
    onFail: [
      { kind: 'delta', stat: 'debt', amount: 0.2 },
      { kind: 'delta', stat: 'happiness', amount: -3 },
    ],
    headlines: 40,
  },
  {
    id: 'buy_country',
    nameKey: 'action.buyCountry.name',
    actors: ['trump', 'lutnick'],
    room: 'mapRoom',
    cost: { ea: 2 },
    requires: { iqMax: 65 },
    baseSuccess: 30,
    onSuccess: [
      { kind: 'delta', stat: 'debt', amount: 2 },
      { kind: 'delta', stat: 'iq', amount: -8 },
      { kind: 'delta', stat: 'defcon', amount: -1 },
      { kind: 'purchaseCountry' },
    ],
    onFail: [
      { kind: 'delta', stat: 'iq', amount: -8 },
      { kind: 'delta', stat: 'defcon', amount: -1 },
    ],
    headlines: 70,
  },
  {
    id: 'lower_interest_rates',
    nameKey: 'action.lowerInterestRates.name',
    actors: ['bessent'],
    room: 'federalReserve',
    cost: { ea: 2 },
    baseSuccess: 50,
    onSuccess: [
      { kind: 'delta', stat: 'interestRate', amount: -0.5 },
      { kind: 'spread', stat: 'inflation', amount: 0.5, months: 6 },
    ],
    onFail: [{ kind: 'delta', stat: 'happiness', amount: -3 }],
    headlines: 45,
  },
  {
    id: 'fire_fed_chair',
    nameKey: 'action.fireFedChair.name',
    actors: ['trump'],
    room: 'ovalOffice',
    cost: { ea: 2 },
    requires: { iqMax: 60 },
    baseSuccess: 40,
    onSuccess: [
      { kind: 'delta', stat: 'interestRate', amount: 1 },
      { kind: 'delta', stat: 'iq', amount: -5 },
      { kind: 'flag', set: 'fedChairFired' },
    ],
    onFail: [
      { kind: 'delta', stat: 'happiness', amount: -4 },
      { kind: 'delta', stat: 'iq', amount: -3 },
    ],
    headlines: 55,
  },
  {
    id: 'fire_statistician',
    nameKey: 'action.fireStatistician.name',
    actors: ['trump'],
    room: 'ovalOffice',
    cost: { ea: 1 },
    requires: { iqMax: 70 },
    baseSuccess: 95,
    onSuccess: [
      { kind: 'delta', stat: 'inflation', amount: -3 },
      { kind: 'delta', stat: 'iq', amount: -5 },
      { kind: 'flag', set: 'statisticianFired' },
    ],
    onFail: [{ kind: 'delta', stat: 'iq', amount: -2 }],
    headlines: 35,
  },
  {
    id: 'mint_platinum_coin',
    nameKey: 'action.mintPlatinumCoin.name',
    actors: ['bessent'],
    room: 'treasury',
    cost: { ea: 2 },
    requires: { iqMax: 60 },
    baseSuccess: 85,
    onSuccess: [
      { kind: 'delta', stat: 'debt', amount: -1 },
      { kind: 'delta', stat: 'iq', amount: -10 },
      { kind: 'spread', stat: 'inflation', amount: 2, months: 6 },
      { kind: 'spread', stat: 'feltInflation', amount: 3, months: 6 },
    ],
    onFail: [{ kind: 'delta', stat: 'debt', amount: 0.1 }],
    headlines: 50,
  },
  {
    id: 'doge_chainsaw',
    nameKey: 'action.dogeChainsaw.name',
    actors: ['musk'],
    requires: { notFlags: ['elonLeftCabinet'] },
    room: 'treasury',
    cost: { ea: 1 },
    baseSuccess: 80,
    onSuccess: [
      { kind: 'delta', stat: 'debt', amount: -2 },
      { kind: 'delayed', stat: 'debt', amount: 1.95, inMonths: 4 },
      { kind: 'delta', stat: 'happiness', amount: -5 },
      // 30% chance this particular cut lands on the Department of Energy — gates the
      // reactor-inspection random event (`data/events.ts`, GAME_PLAN §13) on it actually
      // having happened, rather than that event firing regardless of what got cut.
      {
        kind: 'chance',
        p: 0.3,
        then: [{ kind: 'flag', set: 'dogeCutEnergy' }],
        else: [],
      },
    ],
    onFail: [{ kind: 'delta', stat: 'happiness', amount: -6 }],
    headlines: 30,
  },
  {
    id: 'military_parade',
    nameKey: 'action.militaryParade.name',
    actors: ['trump'],
    room: 'nationalMall',
    cost: { ea: 1 },
    baseSuccess: 50,
    onSuccess: [{ kind: 'delta', stat: 'happiness', amount: 5 }],
    onFail: [{ kind: 'delta', stat: 'happiness', amount: -5 }],
    headlines: 25,
  },
  {
    id: 'read_briefing',
    nameKey: 'action.readBriefing.name',
    actors: 'any',
    room: 'situationRoom',
    cost: { ea: 1 },
    limit: 'oncePerMonth',
    baseSuccess: 100,
    onSuccess: [{ kind: 'delta', stat: 'iq', amount: 4 }],
    onFail: [],
    headlines: 0,
  },
  {
    id: 'rally',
    nameKey: 'action.rally.name',
    actors: ['trump'],
    room: 'roseGarden',
    cost: { ea: 1 },
    limit: 'oncePerMonth',
    baseSuccess: 85,
    onSuccess: [
      { kind: 'delta', stat: 'happiness', amount: 4 },
      { kind: 'delta', stat: 'iq', amount: -2 },
    ],
    onFail: [{ kind: 'delta', stat: 'iq', amount: -1 }],
    headlines: 10,
  },
  {
    id: 'press_conference',
    nameKey: 'action.pressConference.name',
    actors: 'any',
    room: 'roseGarden',
    cost: { ea: 1 },
    baseSuccess: 55,
    onSuccess: [
      { kind: 'delta', stat: 'happiness', amount: 6 },
      { kind: 'delta', stat: 'iq', amount: -2 },
    ],
    onFail: [
      { kind: 'delta', stat: 'happiness', amount: -6 },
      { kind: 'delta', stat: 'iq', amount: -1 },
    ],
    headlines: 45,
  },
  {
    id: 'summit',
    nameKey: 'action.summit.name',
    actors: ['vance', 'trump'],
    room: 'mapRoom',
    cost: { ea: 1 },
    limit: 'oncePerMonth',
    baseSuccess: 70,
    onSuccess: [
      { kind: 'delta', stat: 'defcon', amount: 1 },
      { kind: 'delta', stat: 'iq', amount: -2 },
    ],
    onFail: [{ kind: 'delta', stat: 'iq', amount: -1 }],
    headlines: 15,
  },
  {
    id: 'un_speech',
    nameKey: 'action.unSpeech.name',
    // §9 row 28 pairs this with Trump too; there's no built 'UN' room yet (§10), so it's
    // reached via the toolbar catalog like the other rooms still missing a layout.
    actors: ['vance', 'trump'],
    room: 'mapRoom',
    cost: { ea: 1 },
    baseSuccess: 60,
    onSuccess: [
      { kind: 'delta', stat: 'iq', amount: -1 },
      {
        kind: 'chance',
        p: 0.5,
        then: [{ kind: 'delta', stat: 'defcon', amount: -1 }],
        else: [],
      },
    ],
    onFail: [{ kind: 'delta', stat: 'happiness', amount: -2 }],
    headlines: 55,
  },
  {
    id: 'flip',
    nameKey: 'action.flip.name',
    // Vance's signature move (§8): a public reversal, spun as having "always believed"
    // the new position. A full "cancel a specific pending effect" mechanic (as written
    // in §8) is a later refinement; for now it's a flat spin-control stat swing.
    actors: ['vance'],
    room: 'roseGarden',
    cost: { ea: 1 },
    baseSuccess: 75,
    onSuccess: [
      { kind: 'delta', stat: 'happiness', amount: 3 },
      { kind: 'delta', stat: 'iq', amount: -5 },
    ],
    onFail: [{ kind: 'delta', stat: 'happiness', amount: -2 }],
    headlines: 20,
  },
  {
    id: 'be_best',
    nameKey: 'action.beBest.name',
    actors: ['melania'],
    room: 'roseGarden',
    cost: { ea: 1 },
    limit: 'oncePerMonth',
    baseSuccess: 90,
    onSuccess: [{ kind: 'delta', stat: 'happiness', amount: 3 }],
    onFail: [{ kind: 'delta', stat: 'happiness', amount: -1 }],
    headlines: 15,
  },
  {
    id: 'vanish',
    nameKey: 'action.vanish.name',
    // Melania's "Ghost Rogue" signature (§8): slipping off to dig something up. The full
    // "explore restricted rooms for items" mechanic is a later refinement — for now,
    // a real risk/reward stat swing rather than a guaranteed one.
    actors: ['melania'],
    room: 'ovalOffice',
    cost: { ea: 1 },
    baseSuccess: 70,
    onSuccess: [
      { kind: 'delta', stat: 'happiness', amount: 2 },
      { kind: 'delta', stat: 'iq', amount: -1 },
    ],
    onFail: [{ kind: 'delta', stat: 'happiness', amount: -2 }],
    headlines: 40,
  },
  {
    id: 'ninety_day_pause',
    nameKey: 'action.ninetyDayPause.name',
    // §9 row 4: "undoes half a tariff's inflation" would need per-tariff pending-effect
    // tracking to selectively halve (a tariff's inflation is a flat `spread`,
    // indistinguishable once queued from any other pending inflation) — simplified to a
    // flat, modest counter-effect instead of a true "undo half of this specific tariff".
    actors: ['lutnick', 'trump'],
    room: 'ovalOffice',
    cost: { ea: 0 },
    baseSuccess: 90,
    onSuccess: [
      { kind: 'delta', stat: 'inflation', amount: -0.3 },
      { kind: 'delta', stat: 'feltInflation', amount: -0.5 },
      { kind: 'delta', stat: 'happiness', amount: 1 },
    ],
    onFail: [],
    headlines: 15,
  },
  {
    id: 'liberation_day',
    nameKey: 'action.liberationDay.name',
    // §17's roadmap calls this "once per run" — tariffing literally everyone at once
    // isn't a monthly habit. Counts toward Elon's Rage Quit meter (§8: "tariffs on his
    // suppliers"), same as Impose Tariff and the Big Beautiful Bill below.
    actors: ['lutnick'],
    room: 'commerce',
    cost: { ea: 2 },
    limit: 'oncePerRun',
    baseSuccess: 70,
    onSuccess: [
      { kind: 'delta', stat: 'debt', amount: -1.5 },
      { kind: 'spread', stat: 'inflation', amount: 2, months: 4 },
      { kind: 'spread', stat: 'feltInflation', amount: 2.5, months: 4 },
      { kind: 'delta', stat: 'defcon', amount: -1 },
      { kind: 'rage', amount: 15 },
    ],
    onFail: [
      { kind: 'delta', stat: 'happiness', amount: -3 },
      { kind: 'delta', stat: 'debt', amount: 0.1 },
    ],
    headlines: 65,
  },
  {
    id: 'tariff_dividend',
    nameKey: 'action.tariffDividend.name',
    // §9 row 10: "Happiness + only if tariffs brought money in" needs a running tariff-
    // revenue ledger this build doesn't track yet — simplified to a flat, modest payout.
    actors: ['lutnick'],
    room: 'treasury',
    cost: { ea: 1 },
    baseSuccess: 80,
    onSuccess: [
      { kind: 'delta', stat: 'happiness', amount: 3 },
      { kind: 'delta', stat: 'debt', amount: 0.1 },
    ],
    onFail: [{ kind: 'delta', stat: 'happiness', amount: -1 }],
    headlines: 20,
  },
  {
    id: 'launch_memecoin',
    nameKey: 'action.launchMemecoin.name',
    // §9 row 15's "random walk each month" implies an ongoing monthly swing — simplified
    // to one immediate pump-or-rug-pull roll rather than a recurring mechanic.
    actors: ['trump', 'musk'],
    room: 'marALago',
    cost: { ea: 1 },
    baseSuccess: 70,
    onSuccess: [
      {
        kind: 'chance',
        p: 0.5,
        then: [{ kind: 'delta', stat: 'happiness', amount: 4 }],
        else: [{ kind: 'delta', stat: 'happiness', amount: -5 }],
      },
    ],
    onFail: [{ kind: 'delta', stat: 'happiness', amount: -3 }],
    headlines: 30,
  },
  {
    id: 'strategic_crypto_reserve',
    nameKey: 'action.strategicCryptoReserve.name',
    // Same simplification as Launch a Memecoin above: one immediate volatile swing on
    // Debt instead of an ongoing "chart".
    actors: ['bessent'],
    room: 'treasury',
    cost: { ea: 1 },
    baseSuccess: 80,
    onSuccess: [
      {
        kind: 'chance',
        p: 0.4,
        then: [{ kind: 'delta', stat: 'debt', amount: -0.4 }],
        else: [{ kind: 'delta', stat: 'debt', amount: 0.3 }],
      },
    ],
    onFail: [{ kind: 'delta', stat: 'debt', amount: 0.2 }],
    headlines: 25,
  },
  {
    id: 'pay_debt_dogecoin',
    nameKey: 'action.payDebtDogecoin.name',
    actors: ['musk'],
    requires: { iqMax: 45, notFlags: ['elonLeftCabinet'] },
    room: 'treasury',
    cost: { ea: 2 },
    baseSuccess: 10,
    onSuccess: [{ kind: 'delta', stat: 'debt', amount: -5 }],
    onFail: [{ kind: 'delta', stat: 'debt', amount: 1 }],
    headlines: 80,
  },
  {
    id: 'sell_gold_cards',
    nameKey: 'action.sellGoldCards.name',
    actors: ['lutnick'],
    room: 'commerce',
    cost: { ea: 1 },
    baseSuccess: 85,
    onSuccess: [{ kind: 'delta', stat: 'debt', amount: -0.05 }],
    onFail: [],
    headlines: 15,
  },
  {
    id: 'build_ballroom',
    nameKey: 'action.buildBallroom.name',
    // §9 row 21's "unlocks the Ballroom room" is a later refinement — no new walkable
    // room yet, just the flag (kept for a future pass) and the stat hit for now.
    actors: ['trump'],
    room: 'ovalOffice',
    cost: { ea: 2 },
    baseSuccess: 90,
    onSuccess: [
      { kind: 'delta', stat: 'happiness', amount: -3 },
      { kind: 'flag', set: 'ballroomBuilt' },
    ],
    onFail: [{ kind: 'delta', stat: 'happiness', amount: -1 }],
    headlines: 35,
  },
  {
    id: 'golden_dome',
    nameKey: 'action.goldenDome.name',
    // "Absorbs the next DEFCON drop" (§9 row 22) is a real mechanic, not just flavor —
    // see `engine/effects.ts`'s `applyEffect` 'delta' case, which consumes this flag to
    // cancel the next negative `defcon` delta from any source.
    actors: ['trump', 'musk'],
    room: 'pentagon',
    cost: { ea: 2 },
    baseSuccess: 60,
    onSuccess: [
      { kind: 'delta', stat: 'debt', amount: 0.2 },
      { kind: 'flag', set: 'goldenDomeActive' },
    ],
    onFail: [{ kind: 'delta', stat: 'debt', amount: 0.1 }],
    headlines: 40,
  },
  {
    id: 'truth_post_3am',
    nameKey: 'action.truthPost3am.name',
    // §9 row 24 / §8's "Truth Post": free, always-available "spin the wheel". The
    // passive that auto-fires one if Trump does nothing all month is a later refinement.
    actors: ['trump'],
    room: 'ovalOffice',
    cost: { ea: 0 },
    limit: 'oncePerMonth',
    baseSuccess: 100,
    onSuccess: [
      {
        kind: 'chance',
        p: 0.4,
        then: [{ kind: 'delta', stat: 'happiness', amount: 3 }],
        else: [
          {
            kind: 'chance',
            p: 0.5,
            then: [{ kind: 'delta', stat: 'iq', amount: -2 }],
            else: [{ kind: 'delta', stat: 'happiness', amount: -2 }],
          },
        ],
      },
    ],
    onFail: [],
    headlines: 20,
  },
  {
    id: 'government_shutdown',
    nameKey: 'action.governmentShutdown.name',
    // "Next month only 1 EA" (§9 row 25) is a real mechanic — see the `shutdownPending`
    // flag consumed by `engine/economy.ts`'s `tickMonth`/`resolveActionsLeft`.
    actors: ['vance'],
    room: 'capitol',
    cost: { ea: 2 },
    baseSuccess: 70,
    onSuccess: [
      { kind: 'delta', stat: 'happiness', amount: -8 },
      { kind: 'delta', stat: 'debt', amount: -0.02 },
      { kind: 'flag', set: 'shutdownPending' },
    ],
    onFail: [{ kind: 'delta', stat: 'happiness', amount: -4 }],
    headlines: 30,
  },
  {
    id: 'pass_big_beautiful_bill',
    nameKey: 'action.passBigBeautifulBill.name',
    // §9 row 26's "spread over the term" (48 months) is simplified to 24 — long enough to
    // read as "the rest of the term" without a pending queue that outlives most runs.
    // Showdown-gated (see `data/showdowns.ts`), and a big contributor to Elon's Rage
    // Quit meter (§8: "big spending bills").
    actors: ['vance'],
    room: 'capitol',
    cost: { ea: 3 },
    baseSuccess: 45,
    onSuccess: [
      { kind: 'spread', stat: 'debt', amount: 3, months: 24 },
      { kind: 'delta', stat: 'happiness', amount: 8 },
      { kind: 'rage', amount: 40 },
    ],
    onFail: [
      { kind: 'delta', stat: 'happiness', amount: -5 },
      { kind: 'delta', stat: 'iq', amount: -3 },
    ],
    headlines: 70,
  },
  {
    id: 'senate_trial',
    nameKey: 'action.senateTrial.name',
    // The Impeachment Senate-trial showdown (GAME_PLAN §17 Phase 5, previously deferred):
    // only on the table once Congress is actually lost (`congressLost`, flagged by
    // `engine/economy.ts`'s `tickMonth` the month it happens), and there's no "reset the
    // streak" effect kind — success just pushes Happiness back over the impeachment
    // threshold for the month, which is what actually breaks `lowHappinessStreak`
    // (§5/`checkEnding`); failure pushes it further down instead, same DSL as everything
    // else, no new engine mechanic needed.
    actors: ['trump'],
    room: 'capitol',
    requires: { flags: ['congressLost'] },
    cost: { ea: 2 },
    limit: 'oncePerMonth',
    baseSuccess: 45,
    onSuccess: [
      { kind: 'delta', stat: 'happiness', amount: 15 },
      { kind: 'delta', stat: 'iq', amount: -3 },
    ],
    onFail: [
      { kind: 'delta', stat: 'happiness', amount: -10 },
      { kind: 'delta', stat: 'iq', amount: -2 },
    ],
    headlines: 65,
  },
  {
    id: 'executive_order_spree',
    nameKey: 'action.executiveOrderSpree.name',
    // "+2 EA next month" (§9 row 27) is a real mechanic — see the `executiveOrderBonus`
    // flag consumed by `tickMonth`/`resolveActionsLeft`. The injunction ("a judge may
    // freeze 1-2 actions") needs a Federal Judge NPC and an action-freezing mechanic
    // this build doesn't have yet — simplified to a flat fail penalty instead.
    actors: ['trump'],
    room: 'ovalOffice',
    cost: { ea: 1 },
    baseSuccess: 80,
    onSuccess: [{ kind: 'flag', set: 'executiveOrderBonus' }],
    onFail: [{ kind: 'delta', stat: 'happiness', amount: -3 }],
    headlines: 25,
  },
  {
    id: 'hire_adult_in_room',
    nameKey: 'action.hireAdultInRoom.name',
    // §9 row 32's random "1-3 months later" firing is simplified to a fixed 2 months. No
    // Cabinet Room exists yet as its own RoomId (§10) — filed under the Oval Office, the
    // same stand-in `un_speech` uses for the not-yet-built UN room.
    actors: ['bessent'],
    room: 'ovalOffice',
    cost: { ea: 1 },
    baseSuccess: 80,
    onSuccess: [
      { kind: 'delta', stat: 'iq', amount: 10 },
      { kind: 'delayed', stat: 'iq', amount: -10, inMonths: 2 },
    ],
    onFail: [],
    headlines: 20,
  },
  {
    id: 'elon_reconciliation',
    nameKey: 'action.elonReconciliation.name',
    // GAME_PLAN §8's Rage Quit passive: "find him at Starbase with the right item" — no
    // inventory/item system exists yet (ITEM is still a stub — see i18n's
    // `menu.item.stub`), so this is simplified to visiting him at Starbase while he's
    // gone, no item required. Anyone but Elon himself can do it — he's the one who left.
    actors: ['trump', 'vance', 'bessent', 'lutnick', 'melania'],
    room: 'starbase',
    cost: { ea: 1 },
    requires: { flags: ['elonLeftCabinet'] },
    baseSuccess: 100,
    onSuccess: [
      { kind: 'unflag', clear: 'elonLeftCabinet' },
      { kind: 'rage', amount: -100 },
      { kind: 'delta', stat: 'happiness', amount: 2 },
    ],
    onFail: [],
    headlines: 25,
  },
];

export function getAction(id: string): ActionDef {
  const action = ACTIONS.find((a) => a.id === id);
  if (!action) throw new Error(`Unknown action: ${id}`);
  return action;
}
