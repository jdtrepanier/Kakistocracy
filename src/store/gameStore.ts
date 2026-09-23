import { create } from 'zustand';
import { checkAvailability, type RoomId } from '@/engine/actions';
import { getAction } from '@/data/actions';
import { getBattleground } from '@/data/battlegrounds';
import { getBattleRoster, US_BATTLE_UNITS } from '@/data/battleRosters';
import { DEFAULT_DIFFICULTY, getBalance, type Balance, type DifficultyId } from '@/data/balance';
import { COUNTRIES } from '@/data/countries';
import { actionHasLandmark, LANDMARKS } from '@/data/landmarks';
import { getRoomLayout, ROOM_LAYOUTS } from '@/data/roomLayouts';
import { getShowdownForAction } from '@/data/showdowns';
import {
  actionHasBattle,
  attack,
  checkOutcome,
  createBattle,
  currentUnit,
  enemyTakeTurn,
  endTurn,
  moveUnit,
  targetsInRange,
  type BattleState,
} from '@/engine/battle';
import { grantBonusAction, tickMonth } from '@/engine/economy';
import { rollMonthlyEvent, type EventOutcome } from '@/engine/events';
import { moveWithin, type Direction, type GridPosition } from '@/engine/movement';
import { resolveAction, resolveBattleAction, type ActionResult } from '@/engine/resolve';
import { isShowdownComplete, totalShowdownModifier } from '@/engine/showdown';
import { createInitialState } from '@/engine/state';
import type {
  CharacterId,
  CountryId,
  GameDate,
  GameState,
  ItemId,
  LandmarkId,
  NationStats,
} from '@/engine/types';
import type { MessageKey } from '@/i18n/en';
import { LANGS, type Lang } from '@/i18n/translate';

/** Which full-screen view is showing. Transient UI flow, not part of the engine's GameState.
 * `'intro'` is the opening cutscene (Trump/Vance's Oval Office bit ending in a free,
 * no-stat-effect skirmish against Canada) — `newGame` routes here instead of straight to
 * `'game'`; `IntroScreen.tsx` is the only thing that ever leaves it, either by finishing
 * the cutscene or via its Skip button, both through `finishIntro`. */
export type Screen = 'title' | 'game' | 'monthReport' | 'ending' | 'intro';

/**
 * Phase 2 room slice (GAME_PLAN §11): which cross-menu panel, if any, is open over the
 * room view. Session/UI state, like `Screen` — not part of the simulated `GameState`.
 */
export type OverlayId = 'decree' | 'actions' | 'map' | 'talk' | 'item';

/** Where the party is right now: one shared position, since Phase 2 has no per-official
 * tracking yet (GAME_PLAN §8's per-character positions are a later-phase refinement). */
export interface PlayerState {
  readonly roomId: RoomId;
  readonly pos: GridPosition;
  readonly facing: Direction;
}

/** Officials the player can switch between and send on actions (GAME_PLAN §8). All 6
 * as of the Phase 4 vertical slice; they share the room grid built so far rather than
 * each having their own position (see `PlayerState`'s doc comment). */
export const SWITCHABLE_CHARACTERS: readonly CharacterId[] = [
  'trump',
  'bessent',
  'vance',
  'lutnick',
  'melania',
  'musk',
];

/**
 * Phase 3 resolution flow (GAME_PLAN §7), extended by §7.1's tactical battles: an action
 * goes through an optional showdown, a preview the player confirms, then — for a
 * battle-gated action like `declare_war` — a target-selection screen and a tactical
 * battle instead of an instant roll, and finally a result reveal. `null` means no action
 * is currently being resolved.
 */
export type ResolutionPhase =
  | 'showdown'
  | 'preview'
  | 'selectCountry'
  | 'selectLandmark'
  | 'battle'
  | 'result';

export interface ResolutionState {
  readonly actionId: string;
  readonly phase: ResolutionPhase;
  /** One chosen response index per showdown round completed so far. */
  readonly showdownChoices: readonly number[];
  /** The overlay to reopen once this resolution finishes (whatever DECREE/Actions list
   * the action was picked from), or null if it was picked with no list open. */
  readonly returnOverlay: OverlayId | null;
  /** Stats immediately before the roll, to diff against for the result box. */
  readonly statsBefore: NationStats;
  /** The tactical battle in progress, once the preview is confirmed for a battle-gated
   * action (GAME_PLAN §7.1). Kept around through the 'result' phase too, so the result
   * screen can still show the final battlefield if it wants to. */
  readonly battle?: BattleState;
  /** The country being fought — picked once, before the battle starts, so the target
   * that ends up at war is the one actually fought (see `engine/battle.ts`). */
  readonly battleCountry?: CountryId;
  /** The landmark picked for a `rename_landmark` resolution, once past the
   * 'selectLandmark' phase — substituted into the action's `renameLandmark` effect via
   * `resolveLandmarkEffects` when the roll actually happens (`selectLandmark` below). */
  readonly landmarkId?: LandmarkId;
  /** Set once the roll (or battle) has actually happened (entering the 'result' phase). */
  readonly result?: ActionResult;
  /** The state to adopt when the player continues past the result box. */
  readonly nextGame?: GameState;
}

/**
 * The opening cutscene's own battle-in-progress (`IntroScreen.tsx`), once the player
 * reaches its final beat. Deliberately a *separate* slice from `ResolutionState.battle`
 * rather than reusing the real declare-war flow: the whole point of this fight (per the
 * user's own "free — no stat effect either way" answer) is that it never touches
 * `resolveBattleAction`, `game.atWarWith`, or any stat — win or lose, Month 1 starts
 * completely fresh straight after it. `finishIntro` is the only thing that ever clears
 * this back to `null`.
 */
export interface IntroBattleState {
  readonly battle: BattleState;
  /** Set once `checkOutcome` stops returning `'ongoing'` — `undefined` while the fight is
   * still on. Nothing reads `game`/applies a stat delta when this is set; it only picks
   * which flavor banner `IntroScreen.tsx` shows before `finishIntro`. */
  readonly outcome?: 'usWin' | 'enemyWin';
}

export type MonthReportEntry = ActionResult;

/** A snapshot of one finished month, for the month-end report screen. */
export interface MonthReport {
  /** The month that just ended (not `game.date`, which has already advanced). */
  readonly date: GameDate;
  readonly statsBefore: NationStats;
  readonly statsAfter: NationStats;
  readonly entries: readonly MonthReportEntry[];
  /** The random event rolled for this month (GAME_PLAN §13), or `null` if the run ended
   * before one could fire (see `engine/events.ts`'s `rollMonthlyEvent`). */
  readonly event: EventOutcome | null;
}

/**
 * The only bridge between React and the engine.
 * UI components read from here and call these actions; the actions call pure engine functions.
 */
export interface GameStore {
  game: GameState;
  lang: Lang;
  screen: Screen;
  /** Stats at the start of the month in progress, to diff against for the report. */
  monthStartStats: NationStats;
  /** Actions resolved so far this month, in order, for the report. */
  monthLog: readonly MonthReportEntry[];
  /** The most recently finished month, while its report is showing. */
  monthReport: MonthReport | null;
  /** Name key of the last random event rolled (GAME_PLAN §13), for the news ticker — kept
   * around after the report closes, unlike `monthReport`, since the ticker shows during
   * ordinary room play too. `null` before any month has ended yet this run. */
  lastEventNameKey: MessageKey | null;
  /** Where the party is in the Phase 2 room slice. */
  player: PlayerState;
  /** Which official is currently active (portrait, and who "performs" room actions). */
  activeCharacter: CharacterId;
  /** Which cross-menu panel is open over the room view, if any. */
  overlay: OverlayId | null;
  /** The action currently going through showdown/preview/result, if any. */
  resolution: ResolutionState | null;
  /** Bumped by `triggerShake` every time something impactful happens (a failed action, a
   * landed battle hit) — GAME_PLAN §16/§17's "juice." A counter rather than a boolean so
   * `App.tsx` can restart the shake animation even if it's retriggered before the last
   * one finished (a boolean flip back to the same value wouldn't re-fire a CSS
   * animation). Pure session/UI flourish — not part of `GameState`, never saved. */
  shakeSeq: number;

  /** Which room Melania is hiding in this month (GAME_PLAN §8's hide-and-seek):
   * walking into this room grants +1 Executive Action, once per month. Re-rolled every
   * `endMonth`. Session/UI state, like `player` — not part of the simulated `GameState`,
   * since it's cosmetic flavor rather than a deterministic engine rule. */
  melaniaRoomId: RoomId;
  /** Whether this month's Melania has already been found — guards against grinding the
   * same room-entry for infinite EA. Reset to `false` every `endMonth`. */
  melaniaFoundThisMonth: boolean;

  /** Intern / Normal / Third Term (`data/balance.ts`'s `BALANCES`) — which `Balance`
   * every engine call for the current run is made with. Chosen on the title screen
   * before a run starts; a run in progress keeps whatever it started with even if the
   * title screen's selector is changed afterward (it only affects `newGame`). */
  difficulty: DifficultyId;

  /** Whether a resumable autosave exists (GAME_PLAN §15 "Saves"), for the title screen's
   * Continue button. Kept in sync with localStorage by every action that saves or clears
   * it, rather than re-read from storage on every render. */
  hasSave: boolean;

  /** The opening cutscene's own battle, once `IntroScreen.tsx` starts it — `null` before
   * that point and after the cutscene finishes. See `IntroBattleState`'s doc comment for
   * why this is its own slice rather than reusing `resolution.battle`. */
  introBattle: IntroBattleState | null;

  newGame: (seed?: number) => void;
  /** Sets the difficulty for the *next* `newGame` (title-screen selector, before a run
   * starts) — see `difficulty`'s doc comment. */
  setDifficulty: (id: DifficultyId) => void;
  startGame: () => void;
  /** Loads the autosave (if any) and jumps straight back into the room — or the ending
   * screen, for the unlikely case of a stale save from an older build that had already
   * ended (a normal end-of-run clears the save, see `autosaveSnapshot`). No-op if there's
   * nothing to load. */
  continueGame: () => void;
  endMonth: () => void;
  continueFromReport: () => void;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  movePlayer: (dir: Direction) => void;
  switchCharacter: () => void;
  /** Adds `itemId` to `game.items`, once — a no-op if it's already there (walking back
   * up to an already-collected pedestal, or the intro cutscene's `useEffect` firing more
   * than once, should never duplicate an entry). See `data/items.ts`'s own doc comment
   * for what the two current items are and where each is picked up. */
  grabItem: (itemId: ItemId) => void;
  openOverlay: (id: OverlayId) => void;
  closeOverlay: () => void;
  /** Starts resolving `actionId`: into its showdown if it has one, else straight to preview. */
  beginAction: (actionId: string) => void;
  /** Records the response chosen for the current showdown round. */
  chooseShowdownOption: (choiceIndex: number) => void;
  /** Confirms the preview: rolls the action, or — for a battle-gated action with a
   * country left to fight — moves to target selection instead (GAME_PLAN §7.1). */
  confirmPreview: () => void;
  /** Picks `country` as the target for the battle-gated action currently being resolved
   * (only valid during the 'selectCountry' phase) and starts the tactical battle against
   * it. A no-op for anything not currently eligible, as a last-line sanity check to match
   * `country.warTarget && !atWarWith.includes(country)` — the UI only offers eligible
   * countries as buttons in the first place. */
  selectBattleCountry: (country: CountryId) => void;
  /** Picks `landmark` as the target for the currently-resolving `rename_landmark` (only
   * valid during the 'selectLandmark' phase) and rolls the action against it — a no-op
   * for an already-renamed landmark, as a last-line sanity check to match the UI, which
   * only offers not-yet-renamed landmarks as buttons in the first place. */
  selectLandmark: (landmark: LandmarkId) => void;
  /** Backs out of a showdown, preview, or target selection before the roll happens.
   * Spends nothing. */
  cancelResolution: () => void;
  /** Moves the current battle unit, if it's a living US unit and the tile is reachable. */
  battleMove: (pos: GridPosition) => void;
  /** The current US unit attacks `targetId` (if in range) and ends its turn. */
  battleAttack: (targetId: string) => void;
  /** The current US unit ends its turn without attacking. */
  battleEndTurn: () => void;
  /** Plays out one enemy unit's turn (called by the UI on a short delay, so the player
   * can actually see enemy turns happen instead of the whole battle resolving at once). */
  battleRunEnemyTurn: () => void;
  /** Applies the rolled (or battled) result and returns to the room (or the ending screen). */
  continueResolution: () => void;
  /** Bumps `shakeSeq`, asking `App.tsx` to play a brief screen-shake. Exposed as its own
   * action (rather than folded silently into the moments that call it) so any future
   * juice — a bad random event, an ending reveal — can reuse the exact same trigger. */
  triggerShake: () => void;

  /** Builds and starts the opening cutscene's Canada battle (`IntroScreen.tsx`'s final
   * beat) — same battleground/roster lookup `selectBattleCountry` uses for a real
   * declare-war, just always against `'canada'` and landing in `introBattle` instead of
   * `resolution`. */
  introStartBattle: () => void;
  /** Moves the current intro-battle unit, if it's a living US unit and the tile is
   * reachable — mirrors `battleMove` exactly, just against `introBattle`. */
  introBattleMove: (pos: GridPosition) => void;
  /** The current intro-battle US unit attacks `targetId` — mirrors `battleAttack`. */
  introBattleAttack: (targetId: string) => void;
  /** The current intro-battle US unit ends its turn without attacking. */
  introBattleEndTurn: () => void;
  /** Plays out one intro-battle enemy unit's turn. */
  introBattleRunEnemyTurn: () => void;
  /** Ends the opening cutscene — from its own "the term begins" continue button once the
   * battle resolves, or from its Skip button at any earlier beat (GAME_PLAN: "every new
   * game, skippable"). Either way this is the *only* thing that clears `introBattle` and
   * leaves `screen: 'intro'` — Month 1 starts exactly as `newGame` already built it,
   * since nothing in the cutscene ever touched `game`. */
  finishIntro: () => void;
}

const LANG_STORAGE_KEY = 'maga.lang';

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 32);
}

/** Every room Melania could plausibly be hiding in this month — every walkable room,
 * the Oval Office included (GAME_PLAN §8 doesn't exempt it, and finding her right where
 * you started is a fine gag). Plain `Math.random()`, not the seeded engine RNG, per the
 * same reasoning as `randomSeed()` above: this is session/UI flavor, not a replayable
 * engine roll. */
const MELANIA_ROOMS: readonly RoomId[] = ROOM_LAYOUTS.map((r) => r.id);

function pickMelaniaRoom(): RoomId {
  const index = Math.floor(Math.random() * MELANIA_ROOMS.length);
  return MELANIA_ROOMS[index] as RoomId;
}

function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/** Saved choice first, then the browser language, then English. */
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_STORAGE_KEY);
    if (isLang(saved)) return saved;
  } catch {
    // Storage can be unavailable (private mode, blocked cookies): fall through.
  }
  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('fr')) {
    return 'fr';
  }
  return 'en';
}

function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // Not critical: the language just won't be remembered.
  }
}

const SAVE_STORAGE_KEY = 'maga.save';
const SAVE_VERSION = 1;

/**
 * Autosave (GAME_PLAN §15): everything needed to resume a run exactly where it left off
 * — the engine state plus the UI-layer bits `createInitialState` doesn't know about (room
 * position, active official, the in-progress month's report log, the ticker's last
 * headline). Deliberately excludes transient screen state (`screen`, `overlay`,
 * `resolution`, `monthReport`) — resuming always lands back in the room, never mid-menu,
 * mid-report, or mid-showdown/battle, which is simpler than saving and replaying a
 * half-finished action. Lives here rather than in `engine/` or `data/` per `CLAUDE.md`'s
 * "no localStorage in engine/data" rule — same reasoning as `lang`'s persistence above.
 */
interface SavedGame {
  readonly version: typeof SAVE_VERSION;
  readonly game: GameState;
  readonly monthStartStats: NationStats;
  readonly monthLog: readonly MonthReportEntry[];
  readonly player: PlayerState;
  readonly activeCharacter: CharacterId;
  readonly lastEventNameKey: MessageKey | null;
  readonly melaniaRoomId: RoomId;
  readonly melaniaFoundThisMonth: boolean;
  readonly difficulty: DifficultyId;
}

function isSavedGame(value: unknown): value is SavedGame {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.version === SAVE_VERSION && typeof record.game === 'object' && record.game !== null;
}

function loadSavedGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isSavedGame(parsed) ? parsed : null;
  } catch {
    // Storage can be unavailable, or hold a corrupt/foreign value: treat as no save.
    return null;
  }
}

function writeSavedGame(snapshot: Omit<SavedGame, 'version'>): void {
  try {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ version: SAVE_VERSION, ...snapshot }));
  } catch {
    // Storage can be unavailable — the run just won't be resumable, not fatal.
  }
}

function clearSavedGame(): void {
  try {
    localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // Not critical.
  }
}

function hasSavedGame(): boolean {
  return loadSavedGame() !== null;
}

/** Saves (or, once the run has ended, clears) the autosave, and returns the `hasSave`
 * value the caller's `set()` should adopt — called at every point `game` advances
 * (`endMonth`, `continueResolution`). */
function autosaveSnapshot(snapshot: Omit<SavedGame, 'version'>): boolean {
  if (snapshot.game.ending) {
    clearSavedGame();
    return false;
  }
  writeSavedGame(snapshot);
  return true;
}

const START_ROOM: RoomId = 'ovalOffice';

function initialPlayer(): PlayerState {
  return { roomId: START_ROOM, pos: getRoomLayout(START_ROOM).start, facing: 'down' };
}

type FreshGame = Pick<
  GameStore,
  | 'game'
  | 'monthStartStats'
  | 'monthLog'
  | 'player'
  | 'activeCharacter'
  | 'overlay'
  | 'resolution'
  | 'melaniaRoomId'
  | 'melaniaFoundThisMonth'
  | 'difficulty'
>;

function freshGame(seed: number, difficulty: DifficultyId = DEFAULT_DIFFICULTY): FreshGame {
  const player = initialPlayer();
  const melaniaRoomId = pickMelaniaRoom();
  // Same "found her right where the player already is, with no door transition to catch
  // it on" gap `endMonth` had — `MELANIA_ROOMS`'s doc comment explicitly includes the
  // Oval Office (the player's own starting room) in her candidate pool and calls
  // starting in her room "a fine gag," but nothing actually granted the bonus here
  // before this fix. Real bug found on the same polish pass as `endMonth`'s version.
  const playerAlreadyThere = melaniaRoomId === player.roomId;
  const initialGame = createInitialState(seed, getBalance(difficulty));
  const game = playerAlreadyThere ? grantBonusAction(initialGame) : initialGame;
  return {
    game,
    monthStartStats: game.stats,
    monthLog: [],
    player,
    activeCharacter: SWITCHABLE_CHARACTERS[0] as CharacterId,
    overlay: null,
    resolution: null,
    melaniaRoomId,
    melaniaFoundThisMonth: playerAlreadyThere,
    difficulty,
  };
}

/** After a battle-mutating store action, either keep playing (the battle goes on) or
 * finalize the outcome into the normal result phase (GAME_PLAN §7.1) — shared by every
 * battle action so "did someone just win?" is checked in exactly one place. */
function settleBattle(
  resolution: ResolutionState,
  battle: BattleState,
  game: GameState,
  balance: Balance,
): Pick<GameStore, 'resolution'> {
  const outcome = checkOutcome(battle);
  if (outcome === 'ongoing') {
    return { resolution: { ...resolution, phase: 'battle', battle } };
  }

  const country = resolution.battleCountry;
  if (!country) {
    // Shouldn't happen — every 'battle'-phase resolution carries a battleCountry — but
    // keep the battle visible rather than throwing if it somehow does.
    return { resolution: { ...resolution, phase: 'battle', battle } };
  }

  const action = getAction(resolution.actionId);
  const { state, result } = resolveBattleAction(
    game,
    action,
    outcome === 'usWin',
    country,
    battle.rngState,
    balance,
  );
  return { resolution: { ...resolution, phase: 'result', battle, result, nextGame: state } };
}

/** The opening cutscene's equivalent of `settleBattle` above — much simpler, since it
 * never has a `resolveBattleAction`/stat-effect branch to fall into: an intro battle
 * either keeps going (`'ongoing'`) or is done, full stop, with the outcome kept only for
 * which flavor banner `IntroScreen.tsx` shows before `finishIntro` moves on to Month 1. */
function settleIntroBattle(battle: BattleState): Pick<GameStore, 'introBattle'> {
  const outcome = checkOutcome(battle);
  if (outcome === 'ongoing') return { introBattle: { battle } };
  return { introBattle: { battle, outcome } };
}

export const useGameStore = create<GameStore>()((set, get) => ({
  ...freshGame(randomSeed()),
  lang: initialLang(),
  screen: 'title',
  monthReport: null,
  lastEventNameKey: null,
  hasSave: hasSavedGame(),
  shakeSeq: 0,
  introBattle: null,

  newGame: (seed = randomSeed()) => {
    clearSavedGame();
    set({
      ...freshGame(seed, get().difficulty),
      // Every new game opens with the cutscene (GAME_PLAN: "every new game, skippable")
      // rather than landing straight in the room — `IntroScreen.tsx`'s Skip button (or
      // finishing the cutscene normally) is what actually moves on to `'game'`.
      screen: 'intro',
      introBattle: null,
      monthReport: null,
      lastEventNameKey: null,
      hasSave: false,
    });
  },

  setDifficulty: (id) => set({ difficulty: id }),

  startGame: () => set({ screen: 'game' }),

  continueGame: () => {
    const saved = loadSavedGame();
    if (!saved) return;
    set({
      // Older saves (pre–oil-price, pre-items) won't have these fields — fall back rather
      // than let every economy formula (or the ITEM overlay's `.map`) silently compute
      // with `undefined`.
      game: {
        ...saved.game,
        oilPriceIndex: saved.game.oilPriceIndex ?? 0,
        items: saved.game.items ?? [],
      },
      monthStartStats: saved.monthStartStats,
      monthLog: saved.monthLog,
      player: saved.player,
      activeCharacter: saved.activeCharacter,
      lastEventNameKey: saved.lastEventNameKey,
      // Older saves (pre-Melania/pre-difficulty) won't have these fields — fall back
      // rather than crash.
      melaniaRoomId: saved.melaniaRoomId ?? pickMelaniaRoom(),
      melaniaFoundThisMonth: saved.melaniaFoundThisMonth ?? false,
      difficulty: saved.difficulty ?? DEFAULT_DIFFICULTY,
      overlay: null,
      resolution: null,
      monthReport: null,
      screen: saved.game.ending ? 'ending' : 'game',
    });
  },

  endMonth: () => {
    const {
      game,
      screen,
      overlay,
      resolution,
      monthStartStats,
      monthLog,
      player,
      activeCharacter,
      difficulty,
    } = get();
    // Same guard `movePlayer` already has, for the same reason: the toolbar's End Month
    // button stays mounted (just visually covered) under any overlay or resolution flow
    // (`GameScreen.tsx` renders it unconditionally), so nothing previously stopped a
    // keyboard user tabbing past a still-open preview/showdown/battle/report and firing
    // this anyway. Real bug found on a polish pass: doing so ticks the month from
    // whatever `game` snapshot is current *right now* — which, mid-resolution, is the
    // stale pre-action state — and the abandoned `resolution` then survives the screen
    // swap to `monthReport`; returning to the room afterward and confirming that stale
    // resolution (`continueResolution`) would overwrite the just-advanced month's `game`
    // with the old pre-tick snapshot, silently reverting the date/economy tick/event.
    if (screen !== 'game' || overlay !== null || resolution !== null || game.ending) return;

    const balance = getBalance(difficulty);
    const endedDate = game.date;
    const tickedGame = tickMonth(game, balance);
    const { state: tickedEventGame, outcome } = rollMonthlyEvent(tickedGame, balance);
    const nextMelaniaRoomId = pickMelaniaRoom();

    // Melania's hide-and-seek bonus (GAME_PLAN §8) used to be uncollectable whenever her
    // freshly-rolled room happened to match the room the player is already standing in —
    // `movePlayer`'s own grant only fires on a door *transition* into her room, but
    // re-rolling her location here never moves the player, so there's never a
    // transition to catch it on. Real bug found on a polish pass, contradicting this
    // field's own doc comment ("finding her right where you started is a fine gag").
    // Fixed here, the one place that knows both "where is she now" and "where is the
    // player right now" at the same time — grants the same +1 EA a door-walk-in would.
    const playerAlreadyThere = nextMelaniaRoomId === player.roomId;
    const nextGame = playerAlreadyThere ? grantBonusAction(tickedEventGame) : tickedEventGame;
    // Only claims the ticker line if no bigger monthly event already has it this month —
    // a real event headline should never be silently bumped for this smaller flavor gag.
    const nextLastEventNameKey = outcome
      ? outcome.event.nameKey
      : playerAlreadyThere
        ? 'melania.found'
        : get().lastEventNameKey;

    const hasSave = autosaveSnapshot({
      game: nextGame,
      monthStartStats: nextGame.stats,
      monthLog: [],
      player,
      activeCharacter,
      lastEventNameKey: nextLastEventNameKey,
      melaniaRoomId: nextMelaniaRoomId,
      melaniaFoundThisMonth: playerAlreadyThere,
      difficulty,
    });

    set({
      game: nextGame,
      monthReport: {
        date: endedDate,
        statsBefore: monthStartStats,
        statsAfter: nextGame.stats,
        entries: monthLog,
        event: outcome,
      },
      monthStartStats: nextGame.stats,
      monthLog: [],
      lastEventNameKey: nextLastEventNameKey,
      melaniaRoomId: nextMelaniaRoomId,
      melaniaFoundThisMonth: playerAlreadyThere,
      screen: 'monthReport',
      hasSave,
    });
  },

  continueFromReport: () => {
    const { game } = get();
    set({ monthReport: null, screen: game.ending ? 'ending' : 'game' });
  },

  setLang: (lang) => {
    saveLang(lang);
    set({ lang });
  },
  toggleLang: () => get().setLang(get().lang === 'en' ? 'fr' : 'en'),

  movePlayer: (dir) => {
    const { game, screen, player, overlay, resolution, melaniaRoomId, melaniaFoundThisMonth } =
      get();
    // No walking around while a menu, report or resolution flow is open, or the term is over.
    if (screen !== 'game' || overlay !== null || resolution !== null || game.ending) return;

    const layout = getRoomLayout(player.roomId);
    const nextPos = moveWithin(layout.grid, player.pos, dir);
    const door = layout.doors.find((d) => d.at.x === nextPos.x && d.at.y === nextPos.y);
    if (door) {
      // Melania's hide-and-seek (GAME_PLAN §8): walking through a door into the room
      // she's hiding in this month, for the first time this month, grants +1 EA. Checked
      // on door transitions only (not every step within a room) — see `melaniaRoomId`'s
      // doc comment.
      if (door.to === melaniaRoomId && !melaniaFoundThisMonth) {
        set({
          player: { roomId: door.to, pos: getRoomLayout(door.to).start, facing: dir },
          game: grantBonusAction(game),
          melaniaFoundThisMonth: true,
          lastEventNameKey: 'melania.found',
        });
        return;
      }
      set({ player: { roomId: door.to, pos: getRoomLayout(door.to).start, facing: dir } });
      return;
    }
    set({ player: { ...player, pos: nextPos, facing: dir } });
  },

  switchCharacter: () => {
    const { activeCharacter } = get();
    const index = SWITCHABLE_CHARACTERS.indexOf(activeCharacter);
    const next = SWITCHABLE_CHARACTERS[(index + 1) % SWITCHABLE_CHARACTERS.length];
    if (next) set({ activeCharacter: next });
  },

  grabItem: (itemId) => {
    const { game } = get();
    if (game.items.includes(itemId)) return;
    set({ game: { ...game, items: [...game.items, itemId] } });
  },

  openOverlay: (id) => set({ overlay: id }),
  closeOverlay: () => set({ overlay: null }),

  beginAction: (actionId) => {
    const { game, screen, overlay, activeCharacter } = get();
    if (screen !== 'game' || game.ending) return;

    const action = getAction(actionId);
    if (!checkAvailability(action, game, activeCharacter).ok) return;

    const showdown = getShowdownForAction(actionId);
    set({
      overlay: null,
      resolution: {
        actionId,
        phase: showdown ? 'showdown' : 'preview',
        showdownChoices: [],
        returnOverlay: overlay,
        statsBefore: game.stats,
      },
    });
  },

  chooseShowdownOption: (choiceIndex) => {
    const { resolution } = get();
    if (!resolution || resolution.phase !== 'showdown') return;

    const showdown = getShowdownForAction(resolution.actionId);
    if (!showdown) return;

    const nextChoices = [...resolution.showdownChoices, choiceIndex];
    set({
      resolution: {
        ...resolution,
        showdownChoices: nextChoices,
        phase: isShowdownComplete(showdown, nextChoices) ? 'preview' : 'showdown',
      },
    });
  },

  confirmPreview: () => {
    const { resolution, game, difficulty } = get();
    if (!resolution || resolution.phase !== 'preview') return;

    const balance = getBalance(difficulty);
    const action = getAction(resolution.actionId);

    if (actionHasBattle(action.id)) {
      const eligible = COUNTRIES.some((c) => c.warTarget && !game.atWarWith.includes(c.id));
      if (eligible) {
        // Target-selection screen (previously an automatic random pick) — the player
        // chooses who to fight next; `selectBattleCountry` actually starts the battle.
        set({ resolution: { ...resolution, phase: 'selectCountry' } });
        return;
      }
      // Every eligible country has already been hit — nobody left to fight. Fall
      // through to the ordinary roll below, same as before battles existed.
    }

    if (actionHasLandmark(action.id)) {
      const eligible = LANDMARKS.some((l) => !game.renamedLandmarks.includes(l.id));
      if (eligible) {
        // Same shape as the battle branch just above (real user feedback: "it would be
        // nice to be able to select what you want to rename on the map") — the player
        // picks a landmark; `selectLandmark` actually rolls the action against it.
        set({ resolution: { ...resolution, phase: 'selectLandmark' } });
        return;
      }
      // Every landmark has already been renamed — nothing left to pick. Fall through to
      // the ordinary roll below (`{ kind: 'renameLandmark' }` degrades to an instant
      // no-op random pick in `applyEffect`, same as `declareWar` would here).
    }

    const showdown = getShowdownForAction(resolution.actionId);
    const modifier = showdown ? totalShowdownModifier(showdown, resolution.showdownChoices) : 0;
    const { state, result } = resolveAction(game, action, balance, modifier);

    set({ resolution: { ...resolution, phase: 'result', result, nextGame: state } });
  },

  selectBattleCountry: (country) => {
    const { resolution, game, difficulty } = get();
    if (!resolution || resolution.phase !== 'selectCountry') return;

    const target = COUNTRIES.find((c) => c.id === country);
    if (!target?.warTarget || game.atWarWith.includes(country)) return;

    const balance = getBalance(difficulty);
    // Per-country look (terrain, props — GAME_PLAN §7.1, `data/battlegrounds.ts`): only
    // the walkable `grid` and the two spawn arrays feed the actual simulated battle;
    // `BattleView.tsx` looks up the same `getBattleground(country)` again itself for the
    // terrain/props it renders, rather than this resolution state carrying them around.
    const battleground = getBattleground(country);
    const usSpawns = SWITCHABLE_CHARACTERS.map((id, i) => ({
      template: US_BATTLE_UNITS[id],
      pos: battleground.usSpawns[i] as GridPosition,
    }));
    const enemySpawns = getBattleRoster(country).map((template, i) => ({
      template,
      pos: battleground.enemySpawns[i] as GridPosition,
    }));
    const battle = createBattle(battleground.grid, usSpawns, enemySpawns, game.rngState);
    set(
      settleBattle(
        { ...resolution, phase: 'battle', battleCountry: country },
        battle,
        game,
        balance,
      ),
    );
  },

  selectLandmark: (landmark) => {
    const { resolution, game, difficulty } = get();
    if (!resolution || resolution.phase !== 'selectLandmark') return;
    if (game.renamedLandmarks.includes(landmark)) return;

    const balance = getBalance(difficulty);
    const action = getAction(resolution.actionId);
    const showdown = getShowdownForAction(resolution.actionId);
    const modifier = showdown ? totalShowdownModifier(showdown, resolution.showdownChoices) : 0;
    const { state, result } = resolveAction(game, action, balance, modifier, landmark);

    set({
      resolution: { ...resolution, phase: 'result', landmarkId: landmark, result, nextGame: state },
    });
  },

  cancelResolution: () => {
    const { resolution } = get();
    if (!resolution) return;
    set({ resolution: null, overlay: resolution.returnOverlay });
  },

  battleMove: (pos) => {
    const { resolution, game, difficulty } = get();
    const battle = resolution?.battle;
    if (!resolution || resolution.phase !== 'battle' || !battle) return;
    const unit = currentUnit(battle);
    if (unit.side !== 'us') return;
    const moved = moveUnit(battle, unit.id, pos);

    // Auto-end the turn once a move actually happens and leaves the unit with nobody
    // to attack — user feedback: having to click End Turn every time a move can't
    // reach an enemy was pure friction. Attacking itself stays a manual click
    // (`battleAttack`, below) — who to hit is a real choice, never auto-picked.
    if (
      moved.movedThisTurn &&
      !battle.movedThisTurn &&
      targetsInRange(moved, unit.id).length === 0
    ) {
      set(settleBattle(resolution, endTurn(moved), game, getBalance(difficulty)));
      return;
    }
    set({ resolution: { ...resolution, battle: moved } });
  },

  battleAttack: (targetId) => {
    const { resolution, game, difficulty } = get();
    const battle = resolution?.battle;
    if (!resolution || resolution.phase !== 'battle' || !battle) return;
    const unit = currentUnit(battle);
    if (unit.side !== 'us') return;
    if (!targetsInRange(battle, unit.id).some((t) => t.id === targetId)) return;

    const afterAttack = attack(battle, unit.id, targetId).state;
    get().triggerShake();
    set(settleBattle(resolution, endTurn(afterAttack), game, getBalance(difficulty)));
  },

  battleEndTurn: () => {
    const { resolution, game, difficulty } = get();
    const battle = resolution?.battle;
    if (!resolution || resolution.phase !== 'battle' || !battle) return;
    const unit = currentUnit(battle);
    if (unit.side !== 'us') return;
    set(settleBattle(resolution, endTurn(battle), game, getBalance(difficulty)));
  },

  battleRunEnemyTurn: () => {
    const { resolution, game, difficulty } = get();
    const battle = resolution?.battle;
    if (!resolution || resolution.phase !== 'battle' || !battle) return;
    const unit = currentUnit(battle);
    if (unit.side !== 'enemy') return;
    const afterTurn = enemyTakeTurn(battle, unit.id);
    // `enemyTakeTurn` only actually attacks (appending a log entry) if it ended its move
    // within range of a US unit — sometimes it just repositions, which isn't a hit.
    if (afterTurn.log.length > battle.log.length) get().triggerShake();
    set(settleBattle(resolution, endTurn(afterTurn), game, getBalance(difficulty)));
  },

  continueResolution: () => {
    const {
      resolution,
      monthLog,
      monthStartStats,
      player,
      activeCharacter,
      lastEventNameKey,
      melaniaRoomId,
      melaniaFoundThisMonth,
      difficulty,
    } = get();
    if (
      !resolution ||
      resolution.phase !== 'result' ||
      !resolution.result ||
      !resolution.nextGame
    ) {
      return;
    }

    const nextGame = resolution.nextGame;
    const nextMonthLog = [...monthLog, resolution.result];
    const hasSave = autosaveSnapshot({
      game: nextGame,
      monthStartStats,
      monthLog: nextMonthLog,
      player,
      activeCharacter,
      lastEventNameKey,
      melaniaRoomId,
      melaniaFoundThisMonth,
      difficulty,
    });

    set({
      game: nextGame,
      monthLog: nextMonthLog,
      screen: nextGame.ending ? 'ending' : 'game',
      overlay: nextGame.ending ? null : resolution.returnOverlay,
      resolution: null,
      hasSave,
    });
  },

  triggerShake: () => set((s) => ({ shakeSeq: s.shakeSeq + 1 })),

  introStartBattle: () => {
    const { game } = get();
    // Always Canada, always the same lookup `selectBattleCountry` uses for a real
    // declare-war — see `IntroBattleState`'s doc comment for why the *result* never
    // reaches `resolveBattleAction`/`game` the way a real battle's does.
    const battleground = getBattleground('canada');
    const usSpawns = SWITCHABLE_CHARACTERS.map((id, i) => ({
      template: US_BATTLE_UNITS[id],
      pos: battleground.usSpawns[i] as GridPosition,
    }));
    const enemySpawns = getBattleRoster('canada').map((template, i) => ({
      template,
      pos: battleground.enemySpawns[i] as GridPosition,
    }));
    // Seeded off `game.rngState` alone, never written back to it — the intro battle's own
    // `BattleState.rngState` evolves independently from there, so this fight can never
    // consume/advance the real run's RNG stream, matching "free" in every sense.
    const battle = createBattle(battleground.grid, usSpawns, enemySpawns, game.rngState);
    set({ introBattle: { battle } });
  },

  introBattleMove: (pos) => {
    const { introBattle } = get();
    const battle = introBattle?.battle;
    if (!battle || introBattle?.outcome) return;
    const unit = currentUnit(battle);
    if (unit.side !== 'us') return;
    const moved = moveUnit(battle, unit.id, pos);

    // Same auto-end-turn-on-a-no-target-move friction fix the real `battleMove` has.
    if (
      moved.movedThisTurn &&
      !battle.movedThisTurn &&
      targetsInRange(moved, unit.id).length === 0
    ) {
      set(settleIntroBattle(endTurn(moved)));
      return;
    }
    set({ introBattle: { battle: moved } });
  },

  introBattleAttack: (targetId) => {
    const { introBattle } = get();
    const battle = introBattle?.battle;
    if (!battle || introBattle?.outcome) return;
    const unit = currentUnit(battle);
    if (unit.side !== 'us') return;
    if (!targetsInRange(battle, unit.id).some((t) => t.id === targetId)) return;

    const afterAttack = attack(battle, unit.id, targetId).state;
    get().triggerShake();
    set(settleIntroBattle(endTurn(afterAttack)));
  },

  introBattleEndTurn: () => {
    const { introBattle } = get();
    const battle = introBattle?.battle;
    if (!battle || introBattle?.outcome) return;
    const unit = currentUnit(battle);
    if (unit.side !== 'us') return;
    set(settleIntroBattle(endTurn(battle)));
  },

  introBattleRunEnemyTurn: () => {
    const { introBattle } = get();
    const battle = introBattle?.battle;
    if (!battle || introBattle?.outcome) return;
    const unit = currentUnit(battle);
    if (unit.side !== 'enemy') return;
    const afterTurn = enemyTakeTurn(battle, unit.id);
    if (afterTurn.log.length > battle.log.length) get().triggerShake();
    set(settleIntroBattle(endTurn(afterTurn)));
  },

  finishIntro: () => set({ screen: 'game', introBattle: null }),
}));
