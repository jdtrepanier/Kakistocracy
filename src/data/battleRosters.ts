import type { BattleUnitTemplate } from '@/engine/battle';
import type { CharacterId, CountryId } from '@/engine/types';
import { getCharacter } from './characters';

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
 */
export const US_BATTLE_UNITS: Readonly<Record<CharacterId, BattleUnitTemplate>> = {
  trump: {
    id: 'trump',
    move: 2,
    range: 1,
    power: 5,
    maxComposure: 16,
    placeholder: { initials: 'DT', color: '#c8323c' },
    sprite: getCharacter('trump').sprite,
    // "60% chance of escaping like a coward" — backs out of his own attack entirely
    // (engine/battle.ts's `attack`), rather than dodging an incoming one.
    fleeChance: 0.6,
  },
  vance: {
    id: 'vance',
    move: 3,
    range: 1,
    power: 4,
    maxComposure: 12,
    placeholder: { initials: 'JV', color: '#3a6ea5' },
    sprite: getCharacter('vance').sprite,
    // "20% chance of hitting himself like a dumb guy" — the hit redirects onto Vance.
    selfHitChance: 0.2,
  },
  bessent: {
    id: 'bessent',
    move: 3,
    range: 1,
    power: 3,
    maxComposure: 12,
    placeholder: { initials: 'SB', color: '#3f9b5b' },
    sprite: getCharacter('bessent').sprite,
  },
  lutnick: {
    id: 'lutnick',
    move: 2,
    range: 1,
    power: 4,
    maxComposure: 12,
    placeholder: { initials: 'HL', color: '#b07d2b' },
    sprite: getCharacter('lutnick').sprite,
  },
  melania: {
    id: 'melania',
    move: 4,
    range: 1,
    power: 3,
    maxComposure: 10,
    placeholder: { initials: 'M', color: '#8a6bbf' },
    sprite: getCharacter('melania').sprite,
    // Sorcerer magic: once charged (3 MP, +1 per her own turn), a 50% chance per turn to
    // curse instead of attack — permanently halves the target's power for the rest of
    // the battle rather than dealing a hit (engine/battle.ts's `castCurse`).
    isWoman: true,
    magic: { kind: 'sorcerer', max: 3, chance: 0.5 },
  },
  musk: {
    id: 'musk',
    move: 3,
    range: 1,
    power: 5,
    maxComposure: 10,
    placeholder: { initials: 'EM', color: '#2bb0b0' },
    sprite: getCharacter('musk').sprite,
  },
};

export const BATTLE_ROSTERS: Readonly<Record<CountryId, readonly BattleUnitTemplate[]>> = {
  canada: [
    {
      id: 'canada-carney',
      nameKey: 'battle.unit.canada.carney',
      move: 2,
      range: 1,
      power: 3,
      // "High HP" — above the roster's ~10-12 baseline, below the wildcard's "really
      // high" tier further down. (Halved in the Canada balance pass — see this file's
      // top doc comment — from an original 18.)
      maxComposure: 9,
      placeholder: { initials: 'MC', color: '#c8323c' },
      sprite: {
        front: '/assets/sprites/canada/carney-front.png',
        back: '/assets/sprites/canada/carney-back.png',
        left: '/assets/sprites/canada/carney-left.png',
        right: '/assets/sprites/canada/carney-right.png',
      },
      // Charm magic: once charged (3 MP, +1 per his own turn), a 50% chance per turn to
      // charm instead of attack — the target throws one punch at a random ally of their
      // own side instead (engine/battle.ts's `castCharm`).
      magic: { kind: 'charm', max: 3, chance: 0.5 },
    },
    {
      id: 'canada-trudeau',
      nameKey: 'battle.unit.canada.trudeau',
      move: 3,
      range: 1,
      power: 3,
      // "Low HP" — well under the roster's ~10-12 baseline; offset by healsFromWomen
      // below, so a longer fight against Melania specifically plays very differently.
      // (Halved in the Canada balance pass — see this file's top doc comment — from an
      // original 7.)
      maxComposure: 4,
      placeholder: { initials: 'JT', color: '#3a6ea5' },
      sprite: {
        front: '/assets/sprites/canada/trudeau-front.png',
        back: '/assets/sprites/canada/trudeau-back.png',
        left: '/assets/sprites/canada/trudeau-left.png',
        right: '/assets/sprites/canada/trudeau-right.png',
      },
      // "HP can increase if hit by a woman" — the only woman who can ever attack him
      // (Canada's roster has no women of its own to trigger this, only cross-side hits
      // count) is Melania (`isWoman: true` on US_BATTLE_UNITS.melania above); when she
      // hits him, engine/battle.ts's `attack` heals instead of damages.
      healsFromWomen: true,
    },
    {
      id: 'canada-miller',
      nameKey: 'battle.unit.canada.miller',
      move: 2,
      range: 1,
      power: 3,
      maxComposure: 5, // Halved in the Canada balance pass (see top doc comment) from 10.
      placeholder: { initials: 'MM', color: '#8f7228' },
      sprite: {
        front: '/assets/sprites/canada/miller-front.png',
        back: '/assets/sprites/canada/miller-back.png',
        left: '/assets/sprites/canada/miller-left.png',
        right: '/assets/sprites/canada/miller-right.png',
      },
      // "50% chance of backstabbing his own party" — his attack redirects onto a random
      // living Canada teammate instead of the intended US target.
      backstabChance: 0.5,
    },
    {
      id: 'canada-joly',
      nameKey: 'battle.unit.canada.joly',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 5, // Halved in the Canada balance pass (see top doc comment) from 10.
      placeholder: { initials: 'MJ', color: '#3f9b5b' },
      sprite: {
        front: '/assets/sprites/canada/joly-front.png',
        back: '/assets/sprites/canada/joly-back.png',
        left: '/assets/sprites/canada/joly-left.png',
        right: '/assets/sprites/canada/joly-right.png',
      },
      // Data-accurate, not currently load-bearing: `healsFromWomen` only ever checks the
      // *attacker's* `isWoman`, and Joly can only ever be attacked by other Canada-side
      // units (via Miller's backstab), none of whom are marked `isWoman` — so this has
      // no effect on a battle today. Left set for correctness, in case that changes.
      isWoman: true,
    },
    {
      id: 'canada-leblanc',
      nameKey: 'battle.unit.canada.leblanc',
      move: 2,
      range: 1,
      power: 3,
      maxComposure: 5, // Halved in the Canada balance pass (see top doc comment) from 10.
      placeholder: { initials: 'DL', color: '#8a6bbf' },
      sprite: {
        front: '/assets/sprites/canada/leblanc-front.png',
        back: '/assets/sprites/canada/leblanc-back.png',
        left: '/assets/sprites/canada/leblanc-left.png',
        right: '/assets/sprites/canada/leblanc-right.png',
      },
      // "50% risk of just avoiding the hit" — a defender-side check: whoever ends up
      // attacking LeBlanc has a flat 50% chance of the hit whiffing entirely.
      dodgeChance: 0.5,
    },
    {
      id: 'canada-singh',
      nameKey: 'battle.unit.canada.singh',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 6, // Halved in the Canada balance pass (see top doc comment) from 12.
      placeholder: { initials: 'JS', color: '#e0782c' },
      // Only a front pose exists for Singh (no dedicated back/left/right reference art,
      // unlike the rest of this roster) — `spriteForFacing` (engine/battle.ts) falls
      // back to `front` for the poses he doesn't have, so he just doesn't turn.
      sprite: { front: '/assets/sprites/canada/singh-front.png' },
    },
    {
      id: 'canada-sugar-shack-guy',
      nameKey: 'battle.unit.canada.sugarShackGuy',
      move: 3,
      range: 1,
      power: 5,
      // "Random guy = Really high HP" — the roster's highest, above Carney's "High HP".
      // (Halved in the Canada balance pass — see this file's top doc comment — from an
      // original 24.)
      maxComposure: 12,
      placeholder: { initials: '?', color: '#b0402c' },
      // Re-cropped from a user-supplied reference sheet, same as Joly above — the new art
      // reads as a "cabane à sucre" maple-syrup worker (toque, plaid, suspenders, sap
      // buckets and a tapping stick) rather than the original "guy in a Mackinaw jacket"
      // placeholder concept, so the id/name/sprite filenames were all renamed to match
      // (`canada-mackinaw-guy` → `canada-sugar-shack-guy`) rather than keeping a
      // mismatched internal name for the same "deliberately fictional wildcard" character
      // (GAME_PLAN §7.1's roster-identity doc comment, updated to match).
      sprite: {
        front: '/assets/sprites/canada/sugar-shack-guy-front.png',
        back: '/assets/sprites/canada/sugar-shack-guy-back.png',
        left: '/assets/sprites/canada/sugar-shack-guy-left.png',
        right: '/assets/sprites/canada/sugar-shack-guy-right.png',
      },
    },
  ],
  greenland: [
    {
      id: 'greenland-bear-a',
      nameKey: 'battle.unit.greenland.polarBearA',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 12,
      placeholder: { initials: '\u{1F43B}', color: '#e8ecf2' },
      sprite: {
        front: '/assets/sprites/greenland/bear-front.png',
        back: '/assets/sprites/greenland/bear-back.png',
      },
    },
    {
      id: 'greenland-bear-b',
      nameKey: 'battle.unit.greenland.polarBearB',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 12,
      placeholder: { initials: '\u{1F43B}', color: '#e8ecf2' },
      sprite: {
        front: '/assets/sprites/greenland/bear-front.png',
        back: '/assets/sprites/greenland/bear-back.png',
      },
    },
    {
      id: 'greenland-bear-c',
      nameKey: 'battle.unit.greenland.polarBearC',
      move: 3,
      range: 1,
      power: 3,
      maxComposure: 10,
      placeholder: { initials: '\u{1F43B}', color: '#e8ecf2' },
      sprite: {
        front: '/assets/sprites/greenland/bear-front.png',
        back: '/assets/sprites/greenland/bear-back.png',
      },
    },
    {
      id: 'greenland-bear-boss',
      nameKey: 'battle.unit.greenland.polarBearBoss',
      move: 1,
      range: 1,
      power: 6,
      maxComposure: 18,
      placeholder: { initials: '\u{1F43B}', color: '#cfd8e6' },
      // Same art as the other three — GAME_PLAN §7.1 gives the boss a bigger stat block,
      // not a distinct sprite; a single bear reference sheet only has the one animal.
      sprite: {
        front: '/assets/sprites/greenland/bear-front.png',
        back: '/assets/sprites/greenland/bear-back.png',
      },
    },
    {
      id: 'greenland-seal',
      nameKey: 'battle.unit.greenland.seal',
      move: 2,
      range: 1,
      power: 2,
      // The roster's weakest unit and deliberately its comic relief — "he's just
      // sitting there" energy, one or two hits and he's out. No dodge/quirk despite an
      // early draft giving him one (see this file's top doc comment): a battle-simulator
      // run (`scripts/simulateBattle.ts`) caught that simply adding a 5th enemy unit —
      // regardless of the new unit's own stats — dropped Greenland's US win rate from
      // ~96% to ~41-54% (a *5th* unit against the US's fixed 6 removes one of the US's
      // "spare unanswered turn" slots each round while also adding a whole extra
      // attacker from round 1, the same turn-order-economy effect diagnosed for Canada's
      // balance fix above, just smaller). `maxComposure: 3` was tuned empirically (not
      // guessed) to land back in the "clearly winnable but not a walkover" range (~87%
      // at 2000 simulated battles) rather than accidentally making every Greenland fight
      // meaningfully harder than intended for the sake of one flavor unit.
      maxComposure: 3,
      placeholder: { initials: '\u{1F9AD}', color: '#7a8b99' },
      sprite: {
        front: '/assets/sprites/greenland/seal-front.png',
        back: '/assets/sprites/greenland/seal-back.png',
      },
    },
  ],
  panama: [
    {
      id: 'panama-toll-collector',
      nameKey: 'battle.unit.panama.tollCollector',
      move: 2,
      range: 1,
      power: 3,
      maxComposure: 11,
      placeholder: { initials: '$', color: '#3a6ea5' },
    },
    {
      id: 'panama-tour-guide',
      nameKey: 'battle.unit.panama.tourGuide',
      move: 3,
      range: 1,
      power: 3,
      maxComposure: 10,
      placeholder: { initials: 'TG', color: '#3f9b5b' },
    },
    {
      id: 'panama-ship-enthusiast',
      nameKey: 'battle.unit.panama.shipEnthusiast',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 11,
      placeholder: { initials: '\u{1F6A2}', color: '#8f7228' },
    },
  ],
  mexico: [
    {
      id: 'mexico-mariachi',
      nameKey: 'battle.unit.mexico.mariachi',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 12,
      placeholder: { initials: '\u{1F3B8}', color: '#e0782c' },
    },
    {
      id: 'mexico-churro-vendor',
      nameKey: 'battle.unit.mexico.churroVendor',
      move: 3,
      range: 1,
      power: 3,
      maxComposure: 10,
      placeholder: { initials: 'C', color: '#b07d2b' },
    },
    {
      id: 'mexico-customs-officer',
      nameKey: 'battle.unit.mexico.customsOfficer',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 11,
      placeholder: { initials: 'CO', color: '#3a6ea5' },
    },
  ],
  // Same real-art exception as Russia above — user supplied a reference sheet (a
  // Khamenei-like Supreme Leader, a generic suited official, and a generic militia
  // fighter, each front+back) and asked for a 5-unit roster: 1 from the top sprite, 2
  // from the middle, 2 from the bottom, replacing the old 3-unit placeholder lineup
  // entirely. Only the top sprite reads as a specific, named, currently-serving real
  // leader (Khamenei, Iran's actual Supreme Leader) — asked and confirmed "use him
  // anyway" the same way Putin was. The middle/bottom sprites are generic archetypes,
  // not identifiable named individuals, so they keep this roster's existing invented
  // flavor: 2 of the 3 old unit names/ids survive (spokesperson, tvAnchor) paired with
  // the new "official" art (`droneHobbyist` didn't fit the militia-fighter art at all,
  // so it's dropped in favor of two new fighter-flavored units instead). Officials and
  // militia units share one sprite per pair — same "one reference sheet, several units"
  // pattern as Greenland's bears (see that roster below): distinct id/nameKey/stats,
  // identical art. Growing from 3 to 5 units shifts battle balance the same way
  // Greenland's 5th unit did (see that entry's simulator note) — re-tuned against
  // `scripts/simulateBattle.ts` after wiring, not left at first-guess numbers.
  iran: [
    {
      id: 'iran-khamenei',
      nameKey: 'battle.unit.iran.khamenei',
      move: 1,
      range: 1,
      power: 4,
      maxComposure: 11,
      placeholder: { initials: 'AK', color: '#2b2b2b' },
      sprite: {
        front: '/assets/sprites/iran/khamenei-front.png',
        back: '/assets/sprites/iran/khamenei-back.png',
        left: '/assets/sprites/iran/khamenei-left.png',
        right: '/assets/sprites/iran/khamenei-right.png',
      },
    },
    {
      id: 'iran-spokesperson',
      nameKey: 'battle.unit.iran.spokesperson',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 11,
      placeholder: { initials: 'SP', color: '#3f9b5b' },
      sprite: {
        front: '/assets/sprites/iran/official-front.png',
        back: '/assets/sprites/iran/official-back.png',
        left: '/assets/sprites/iran/official-left.png',
        right: '/assets/sprites/iran/official-right.png',
      },
    },
    {
      id: 'iran-tv-anchor',
      nameKey: 'battle.unit.iran.tvAnchor',
      move: 2,
      range: 1,
      power: 3,
      maxComposure: 10,
      placeholder: { initials: 'TV', color: '#8f7228' },
      sprite: {
        front: '/assets/sprites/iran/official-front.png',
        back: '/assets/sprites/iran/official-back.png',
        left: '/assets/sprites/iran/official-left.png',
        right: '/assets/sprites/iran/official-right.png',
      },
    },
    {
      id: 'iran-irgc-fighter',
      nameKey: 'battle.unit.iran.irgcFighter',
      move: 3,
      range: 1,
      power: 3,
      maxComposure: 9,
      placeholder: { initials: 'IF', color: '#3a6ea5' },
      sprite: {
        front: '/assets/sprites/iran/militia-front.png',
        back: '/assets/sprites/iran/militia-back.png',
        left: '/assets/sprites/iran/militia-left.png',
        right: '/assets/sprites/iran/militia-right.png',
      },
    },
    {
      id: 'iran-basij-volunteer',
      nameKey: 'battle.unit.iran.basijVolunteer',
      move: 2,
      range: 1,
      power: 2,
      maxComposure: 7,
      placeholder: { initials: 'BV', color: '#5a7a3a' },
      sprite: {
        front: '/assets/sprites/iran/militia-front.png',
        back: '/assets/sprites/iran/militia-back.png',
        left: '/assets/sprites/iran/militia-left.png',
        right: '/assets/sprites/iran/militia-right.png',
      },
    },
  ],
  venezuela: [
    {
      id: 'venezuela-committee-chair',
      nameKey: 'battle.unit.venezuela.committeeChair',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 11,
      placeholder: { initials: 'CC', color: '#8a6bbf' },
    },
    {
      id: 'venezuela-oil-executive',
      nameKey: 'battle.unit.venezuela.oilExecutive',
      move: 2,
      range: 1,
      power: 3,
      maxComposure: 11,
      placeholder: { initials: 'OE', color: '#3f9b5b' },
    },
    {
      id: 'venezuela-megaphone-guy',
      nameKey: 'battle.unit.venezuela.megaphoneGuy',
      move: 3,
      range: 1,
      power: 4,
      maxComposure: 10,
      placeholder: { initials: '\u{1F4E3}', color: '#e0782c' },
    },
  ],
  // Real people, not invented archetypes — see this file's doc comment for why Russia
  // is the exception. Stats are a straight balance-neutral swap: each new unit keeps the
  // exact move/range/power/maxComposure of the placeholder it replaces, only identity and
  // art changed. Sprites: user-supplied reference sheet, cropped front/back with left/right
  // generated by horizontal flip per the user's own instruction ("for the missing sprites,
  // you can perform an horizontal flip").
  russia: [
    {
      id: 'russia-putin',
      nameKey: 'battle.unit.russia.putin',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 12,
      placeholder: { initials: 'VP', color: '#3a6ea5' },
      sprite: {
        front: '/assets/sprites/russia/putin-front.png',
        back: '/assets/sprites/russia/putin-back.png',
        left: '/assets/sprites/russia/putin-left.png',
        right: '/assets/sprites/russia/putin-right.png',
      },
    },
    {
      id: 'russia-gorbachev',
      nameKey: 'battle.unit.russia.gorbachev',
      move: 2,
      range: 1,
      power: 4,
      maxComposure: 11,
      placeholder: { initials: 'MG', color: '#8f7228' },
      sprite: {
        front: '/assets/sprites/russia/gorbachev-front.png',
        back: '/assets/sprites/russia/gorbachev-back.png',
        left: '/assets/sprites/russia/gorbachev-left.png',
        right: '/assets/sprites/russia/gorbachev-right.png',
      },
    },
    {
      id: 'russia-yeltsin',
      nameKey: 'battle.unit.russia.yeltsin',
      move: 2,
      range: 1,
      power: 5,
      maxComposure: 12,
      placeholder: { initials: 'BY', color: '#c8323c' },
      sprite: {
        front: '/assets/sprites/russia/yeltsin-front.png',
        back: '/assets/sprites/russia/yeltsin-back.png',
        left: '/assets/sprites/russia/yeltsin-left.png',
        right: '/assets/sprites/russia/yeltsin-right.png',
      },
    },
  ],
};

export function getBattleRoster(country: CountryId): readonly BattleUnitTemplate[] {
  return BATTLE_ROSTERS[country];
}
