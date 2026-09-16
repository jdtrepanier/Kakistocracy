import type { MessageKey } from '@/i18n/en';
import { tileAt, type GridPosition, type RoomGrid } from './movement';
import { createRng } from './rng';

/**
 * Tactical battles (GAME_PLAN §7.1): declaring war on a country now plays out as a small
 * Shining-Force-style skirmish against that country's roster (`data/battleRosters.ts`)
 * instead of an instant dice roll — see `engine/resolve.ts`'s `resolveBattleAction`. Pure
 * TypeScript, like the rest of `engine/`: no rendering here, `ui/battle/BattleView.tsx` is
 * the only place a `BattleState` becomes pixels.
 *
 * Rules are deliberately small for v1: a fixed open battlefield (`data/battlefield.ts`),
 * melee-only ranges, one action (move, then optionally attack) per unit per turn, and a
 * simple "close the distance, then swing" enemy AI. Composure is this game's HP — worn
 * down by zingers and photo-ops, not weapons, to keep the same cartoon-disaster,
 * nobody-actually-gets-hurt tone as the rest of the game (GAME_PLAN §14).
 */

export type BattleSide = 'us' | 'enemy';

export interface BattleUnitTemplate {
  readonly id: string;
  /** i18n key for this unit's display name — omitted for a US official, whose name
   * comes from the name layer instead (`data/characters.ts`'s `displayName`, keyed by
   * `id`), per GAME_PLAN §14 / CLAUDE.md's naming rule. */
  readonly nameKey?: MessageKey;
  /** Tiles this unit can move in one turn. */
  readonly move: number;
  /** Manhattan distance at which this unit can attack. 1 = melee-adjacent. */
  readonly range: number;
  /** Base damage to Composure on a hit, before a small random variance. */
  readonly power: number;
  readonly maxComposure: number;
  readonly placeholder: { readonly initials: string; readonly color: string };
  /** Front-facing sprite path, for a unit with real art (`data/characters.ts`'s
   * `CharacterSprite`, or a literal path for a non-switchable roster). Battle units have no
   * facing concept, so only the front pose is used; falls back to `placeholder` when
   * absent. */
  readonly sprite?: string;
}

export interface BattleUnit extends BattleUnitTemplate {
  readonly side: BattleSide;
  readonly composure: number;
  readonly pos: GridPosition;
}

export interface BattleAttackLogEntry {
  readonly kind: 'attack';
  readonly attackerId: string;
  readonly defenderId: string;
  readonly amount: number;
  readonly defeated: boolean;
}

export type BattleLogEntry = BattleAttackLogEntry;

export interface BattleState {
  readonly grid: RoomGrid;
  readonly units: readonly BattleUnit[];
  /** Fixed cycle of unit ids — whoever's turn it is, in order, repeating every round. */
  readonly turnOrder: readonly string[];
  readonly turnIndex: number;
  readonly round: number;
  /** Whether the current unit has already used its move this turn — `moveUnit` is a
   * no-op once this is true, so repeated calls can't stack extra movement. Reset by
   * `endTurn`. Attacking always ends the turn (callers call `endTurn` right after), so
   * no equivalent flag is needed for attacks. */
  readonly movedThisTurn: boolean;
  readonly rngState: number;
  readonly log: readonly BattleLogEntry[];
}

export type BattleOutcome = 'ongoing' | 'usWin' | 'enemyWin';

export interface BattleSpawn {
  readonly template: BattleUnitTemplate;
  readonly pos: GridPosition;
}

/** Only `declare_war` currently plays out as a battle instead of an instant roll. */
export function actionHasBattle(actionId: string): boolean {
  return actionId === 'declare_war';
}

function interleave(a: readonly string[], b: readonly string[]): readonly string[] {
  const result: string[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length) result.push(a[i] as string);
    if (i < b.length) result.push(b[i] as string);
  }
  return result;
}

/** Places both rosters on `grid` and builds a fixed, interleaved turn order (US unit,
 * enemy unit, US unit, …), so nobody's whole side just goes first. */
export function createBattle(
  grid: RoomGrid,
  usSpawns: readonly BattleSpawn[],
  enemySpawns: readonly BattleSpawn[],
  seed: number,
): BattleState {
  const us: BattleUnit[] = usSpawns.map((s) => ({
    ...s.template,
    side: 'us',
    composure: s.template.maxComposure,
    pos: s.pos,
  }));
  const enemy: BattleUnit[] = enemySpawns.map((s) => ({
    ...s.template,
    side: 'enemy',
    composure: s.template.maxComposure,
    pos: s.pos,
  }));

  return {
    grid,
    units: [...us, ...enemy],
    turnOrder: interleave(
      us.map((u) => u.id),
      enemy.map((u) => u.id),
    ),
    turnIndex: 0,
    round: 1,
    movedThisTurn: false,
    rngState: seed,
    log: [],
  };
}

export function livingUnits(state: BattleState, side?: BattleSide): readonly BattleUnit[] {
  return state.units.filter((u) => u.composure > 0 && (side === undefined || u.side === side));
}

export function unitById(state: BattleState, id: string): BattleUnit {
  const unit = state.units.find((u) => u.id === id);
  if (!unit) throw new Error(`Unknown battle unit: ${id}`);
  return unit;
}

export function unitAt(state: BattleState, pos: GridPosition): BattleUnit | undefined {
  return state.units.find((u) => u.composure > 0 && u.pos.x === pos.x && u.pos.y === pos.y);
}

/** `'ongoing'` unless one whole side has been fully worn down. */
export function checkOutcome(state: BattleState): BattleOutcome {
  if (livingUnits(state, 'enemy').length === 0) return 'usWin';
  if (livingUnits(state, 'us').length === 0) return 'enemyWin';
  return 'ongoing';
}

/** The unit whose turn it is right now. */
export function currentUnit(state: BattleState): BattleUnit {
  const id = state.turnOrder[state.turnIndex];
  if (id === undefined) throw new Error('BattleState.turnIndex is out of range');
  return unitById(state, id);
}

function neighborsOf(pos: GridPosition): readonly GridPosition[] {
  return [
    { x: pos.x + 1, y: pos.y },
    { x: pos.x - 1, y: pos.y },
    { x: pos.x, y: pos.y + 1 },
    { x: pos.x, y: pos.y - 1 },
  ];
}

function posKey(pos: GridPosition): string {
  return `${pos.x},${pos.y}`;
}

function isOpenTile(state: BattleState, pos: GridPosition, movingUnitId: string): boolean {
  if (tileAt(state.grid, pos) !== 'floor') return false;
  const occupant = unitAt(state, pos);
  return !occupant || occupant.id === movingUnitId;
}

/** Every tile `unitId` could move to this turn (BFS through open floor tiles, up to its
 * `move` stat), not including the tile it's already standing on. */
export function reachableTiles(state: BattleState, unitId: string): readonly GridPosition[] {
  const unit = unitById(state, unitId);
  const distance = new Map<string, number>([[posKey(unit.pos), 0]]);
  const queue: GridPosition[] = [unit.pos];
  const result: GridPosition[] = [];

  while (queue.length > 0) {
    const pos = queue.shift() as GridPosition;
    const dist = distance.get(posKey(pos)) as number;
    if (dist > 0) result.push(pos);
    if (dist >= unit.move) continue;

    for (const next of neighborsOf(pos)) {
      const key = posKey(next);
      if (distance.has(key) || !isOpenTile(state, next, unitId)) continue;
      distance.set(key, dist + 1);
      queue.push(next);
    }
  }

  return result;
}

/** Moves `unitId` to `to` if it's reachable this turn and it hasn't already moved this
 * turn; otherwise a no-op (see `movedThisTurn`). */
export function moveUnit(state: BattleState, unitId: string, to: GridPosition): BattleState {
  if (state.movedThisTurn) return state;
  const reachable = reachableTiles(state, unitId);
  if (!reachable.some((p) => p.x === to.x && p.y === to.y)) return state;
  return {
    ...state,
    units: state.units.map((u) => (u.id === unitId ? { ...u, pos: to } : u)),
    movedThisTurn: true,
  };
}

function manhattan(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Living opponents of `unitId` within its attack range, from its *current* position. */
export function targetsInRange(state: BattleState, unitId: string): readonly BattleUnit[] {
  const unit = unitById(state, unitId);
  const opponents = livingUnits(state, unit.side === 'us' ? 'enemy' : 'us');
  return opponents.filter((o) => manhattan(unit.pos, o.pos) <= unit.range);
}

/** `attackerId` hits `defenderId` for its power plus a small seeded variance (never less
 * than 1), logging the result. Doesn't validate range — callers check `targetsInRange`. */
export function attack(
  state: BattleState,
  attackerId: string,
  defenderId: string,
): { readonly state: BattleState; readonly entry: BattleAttackLogEntry } {
  const attacker = unitById(state, attackerId);
  const defender = unitById(state, defenderId);
  const rng = createRng(state.rngState);
  const amount = Math.max(1, attacker.power + rng.int(-2, 2));
  const nextComposure = Math.max(0, defender.composure - amount);
  const defeated = nextComposure <= 0;

  const units = state.units.map((u) =>
    u.id === defenderId ? { ...u, composure: nextComposure } : u,
  );
  const entry: BattleAttackLogEntry = { kind: 'attack', attackerId, defenderId, amount, defeated };
  return { state: { ...state, units, rngState: rng.state, log: [...state.log, entry] }, entry };
}

/** Advances to the next living unit's turn, incrementing `round` whenever the order
 * wraps back to the front. No-ops if nobody is left alive (call `checkOutcome` first). */
export function endTurn(state: BattleState): BattleState {
  const total = state.turnOrder.length;
  for (let step = 1; step <= total; step++) {
    const idx = (state.turnIndex + step) % total;
    const id = state.turnOrder[idx];
    const unit = state.units.find((u) => u.id === id);
    if (unit && unit.composure > 0) {
      const wrapped = idx <= state.turnIndex;
      return {
        ...state,
        turnIndex: idx,
        round: wrapped ? state.round + 1 : state.round,
        movedThisTurn: false,
      };
    }
  }
  return state;
}

/**
 * A very small enemy AI, deterministic apart from `attack`'s damage roll: attack a
 * living US unit in range if there is one, otherwise close the distance toward the
 * nearest one as far as this turn's move allows, then attack if that brings one into
 * range. Does not itself end the turn — callers call `endTurn` after.
 */
export function enemyTakeTurn(state: BattleState, unitId: string): BattleState {
  const unit = unitById(state, unitId);
  if (unit.side !== 'enemy' || unit.composure <= 0) return state;

  let working = state;
  if (targetsInRange(working, unitId).length === 0) {
    const targets = livingUnits(working, 'us');
    if (targets.length > 0) {
      const options = [unit.pos, ...reachableTiles(working, unitId)];
      const best = options.reduce((closest, option) => {
        const dist = Math.min(...targets.map((t) => manhattan(option, t.pos)));
        const closestDist = Math.min(...targets.map((t) => manhattan(closest, t.pos)));
        return dist < closestDist ? option : closest;
      });
      working = moveUnit(working, unitId, best);
    }
  }

  const inRange = targetsInRange(working, unitId);
  if (inRange.length === 0) return working;

  const weakest = inRange.reduce((a, b) => (b.composure < a.composure ? b : a));
  return attack(working, unitId, weakest.id).state;
}
