import { create } from 'zustand';
import { checkAvailability, type RoomId } from '@/engine/actions';
import { getAction } from '@/data/actions';
import { BATTLEFIELD, ENEMY_SPAWN_POSITIONS, US_SPAWN_POSITIONS } from '@/data/battlefield';
import { getBattleRoster, US_BATTLE_UNITS } from '@/data/battleRosters';
import { DEFAULT_DIFFICULTY, getBalance, type Balance, type DifficultyId } from '@/data/balance';
import { COUNTRIES } from '@/data/countries';
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
import type { CharacterId, CountryId, GameDate, GameState, NationStats } from '@/engine/types';
import type { MessageKey } from '@/i18n/en';
import { LANGS, type Lang } from '@/i18n/translate';

/** Which full-screen view is showing. Transient UI flow, not part of the engine's GameState. */
export type Screen = 'title' | 'game' | 'monthReport' | 'ending';

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
export type ResolutionPhase = 'showdown' | 'preview' | 'selectCountry' | 'battle' | 'result';

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
  /** Set once the roll (or battle) has actually happened (entering the 'result' phase). */
  readonly result?: ActionResult;
  /** The state to adopt when the player continues past the result box. */
  readonly nextGame?: GameState;
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
  const game = createInitialState(seed, getBalance(difficulty));
  return {
    game,
    monthStartStats: game.stats,
    monthLog: [],
    player: initialPlayer(),
    activeCharacter: SWITCHABLE_CHARACTERS[0] as CharacterId,
    overlay: null,
    resolution: null,
    melaniaRoomId: pickMelaniaRoom(),
    melaniaFoundThisMonth: false,
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

export const useGameStore = create<GameStore>()((set, get) => ({
  ...freshGame(randomSeed()),
  lang: initialLang(),
  screen: 'title',
  monthReport: null,
  lastEventNameKey: null,
  hasSave: hasSavedGame(),

  newGame: (seed = randomSeed()) => {
    clearSavedGame();
    set({
      ...freshGame(seed, get().difficulty),
      screen: 'game',
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
      game: saved.game,
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
    const { game, screen, monthStartStats, monthLog, player, activeCharacter, difficulty } =
      get();
    if (screen !== 'game' || game.ending) return;

    const balance = getBalance(difficulty);
    const endedDate = game.date;
    const tickedGame = tickMonth(game, balance);
    const { state: nextGame, outcome } = rollMonthlyEvent(tickedGame, balance);
    const nextLastEventNameKey = outcome ? outcome.event.nameKey : get().lastEventNameKey;
    const nextMelaniaRoomId = pickMelaniaRoom();

    const hasSave = autosaveSnapshot({
      game: nextGame,
      monthStartStats: nextGame.stats,
      monthLog: [],
      player,
      activeCharacter,
      lastEventNameKey: nextLastEventNameKey,
      melaniaRoomId: nextMelaniaRoomId,
      melaniaFoundThisMonth: false,
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
      melaniaFoundThisMonth: false,
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
    const usSpawns = SWITCHABLE_CHARACTERS.map((id, i) => ({
      template: US_BATTLE_UNITS[id],
      pos: US_SPAWN_POSITIONS[i] as GridPosition,
    }));
    const enemySpawns = getBattleRoster(country).map((template, i) => ({
      template,
      pos: ENEMY_SPAWN_POSITIONS[i] as GridPosition,
    }));
    const battle = createBattle(BATTLEFIELD, usSpawns, enemySpawns, game.rngState);
    set(
      settleBattle(
        { ...resolution, phase: 'battle', battleCountry: country },
        battle,
        game,
        balance,
      ),
    );
  },

  cancelResolution: () => {
    const { resolution } = get();
    if (!resolution) return;
    set({ resolution: null, overlay: resolution.returnOverlay });
  },

  battleMove: (pos) => {
    const { resolution } = get();
    const battle = resolution?.battle;
    if (!resolution || resolution.phase !== 'battle' || !battle) return;
    const unit = currentUnit(battle);
    if (unit.side !== 'us') return;
    set({ resolution: { ...resolution, battle: moveUnit(battle, unit.id, pos) } });
  },

  battleAttack: (targetId) => {
    const { resolution, game, difficulty } = get();
    const battle = resolution?.battle;
    if (!resolution || resolution.phase !== 'battle' || !battle) return;
    const unit = currentUnit(battle);
    if (unit.side !== 'us') return;
    if (!targetsInRange(battle, unit.id).some((t) => t.id === targetId)) return;

    const afterAttack = attack(battle, unit.id, targetId).state;
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
    const nextBattle = endTurn(enemyTakeTurn(battle, unit.id));
    set(settleBattle(resolution, nextBattle, game, getBalance(difficulty)));
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
}));
