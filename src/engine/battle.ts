import type { MessageKey } from '@/i18n/en';
import { tileAt, type GridPosition, type RoomGrid } from './movement';
import { createRng, type Rng } from './rng';

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
 *
 * **Unit quirks (user-requested "let's see HP and MP" pass):** a handful of named units
 * have a personal combat quirk on top of the plain move/range/power/composure stats —
 * a percentage chance of something unusual happening instead of (or in addition to) a
 * normal hit, or a small Magic (MP) pool that occasionally fires a bigger effect. All of
 * it lives in `attack()` (the single place every attack, from a player click or the enemy
 * AI, actually resolves), so no caller needs to know a unit is quirky. Every quirk is
 * "automatic proc" per the chosen design — nothing here adds a new player-facing action
 * or target-picker; a quirky unit still just gets attacked or attacks like any other, the
 * *outcome* just sometimes goes sideways:
 *
 * - `fleeChance` (Trump, 60%): backs out of the attack entirely — no damage, no redirect,
 *   just a `'flee'` log entry. "Escaping like a coward" reads as bailing on his own turn,
 *   not dodging an incoming hit (that's `dodgeChance`, below) — so this only ever applies
 *   when Trump is the attacker.
 * - `selfHitChance` (Vance, 20%): the attack lands on Vance himself instead of the
 *   intended target.
 * - `backstabChance` (Marc Miller, 50%): the attack redirects onto a random living
 *   teammate on Miller's own side instead of the intended opponent. Falls through to a
 *   normal attack if Miller has no living teammate left to backstab.
 * - `dodgeChance` (Dominic LeBlanc, 50%): a defender-side check — whoever ends up
 *   attacking LeBlanc (after any of the above redirects) has a flat chance of the hit
 *   just whiffing entirely, logged as `'dodge'`.
 * - `isWoman` + `healsFromWomen` (Melania is the former; Justin Trudeau is the latter):
 *   when a `healsFromWomen` defender's final attacker is `isWoman`, the "hit" restores
 *   composure instead of removing it (still clamped to `maxComposure`), logged as a
 *   healed `'attack'` entry. Trudeau's `maxComposure` is deliberately low ("Low HP") to
 *   make this actually matter over a longer fight.
 * - `magic` (Mark Carney's Charm, Melania's Sorcerer): a small MP pool (`BattleUnit`'s
 *   `magicCharge`, starting at 0) that fills by 1 every one of that unit's own turns it
 *   doesn't cast (`rechargeMagic`); once full, each of their turns has `magic.chance` to
 *   actually cast instead of attacking normally, resetting the charge to 0. Two spells
 *   exist:
 *     - `'charm'` (Carney): the requested target is charmed into throwing one punch at
 *       a random living ally of their own side, resolved immediately as part of Carney's
 *       turn (`castCharm`) rather than by tracking a "skip your real turn" status across
 *       future turns — simpler to implement and just as funny to watch happen live. If
 *       the target has no living ally left, the charm just fizzles (logged, no hit).
 *     - `'sorcerer'` (Melania): a curse (`castCurse`) that permanently halves the
 *       target's `power` for the rest of the battle, floored at 1, instead of dealing any
 *       damage itself — a lingering debuff rather than one big hit, per design.
 *
 * None of the above is DEFCON/Headlines-visible outside the battle itself — it only ever
 * changes who's left standing at the end, which is all `resolveBattleAction` reads.
 */

export type BattleSide = 'us' | 'enemy';

/** Which spell a magic-capable unit casts once its MP (`magicCharge`) is full and its
 * per-turn cast chance hits. See this file's doc comment for what each one does. */
export type BattleMagicKind = 'charm' | 'sorcerer';

export interface BattleMagic {
  readonly kind: BattleMagicKind;
  /** MP pool size — `magicCharge` must reach this before a cast can even be attempted. */
  readonly max: number;
  /** Chance to actually cast, checked once per own turn, only once `magicCharge` is full. */
  readonly chance: number;
}

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
  /** Base damage to Composure on a hit, before a small random variance. Mutable at the
   * `BattleUnit` level — Melania's Sorcerer curse permanently lowers a target's copy of
   * this, the template itself never changes. */
  readonly power: number;
  readonly maxComposure: number;
  readonly placeholder: { readonly initials: string; readonly color: string };
  /** Front-facing sprite path, for a unit with real art (`data/characters.ts`'s
   * `CharacterSprite`, or a literal path for a non-switchable roster). Battle units have no
   * facing concept, so only the front pose is used; falls back to `placeholder` when
   * absent. */
  readonly sprite?: string;

  /** Personal combat quirks — see this file's doc comment. At most one of
   * `fleeChance`/`selfHitChance`/`backstabChance` is ever set per unit (they're
   * alternatives, not stackable); `dodgeChance` and the heal pair are independent of
   * those and of each other. */
  readonly fleeChance?: number;
  readonly selfHitChance?: number;
  readonly backstabChance?: number;
  readonly dodgeChance?: number;
  readonly isWoman?: boolean;
  readonly healsFromWomen?: boolean;
  readonly magic?: BattleMagic;
}

export interface BattleUnit extends BattleUnitTemplate {
  readonly side: BattleSide;
  readonly composure: number;
  readonly pos: GridPosition;
  /** Current MP, 0 if this unit has no `magic`. See this file's doc comment. */
  readonly magicCharge: number;
}

interface BattleLogEntryBase {
  readonly attackerId: string;
  /** The unit the attack actually landed on (or would have, for a `'flee'`) — after any
   * self-hit/backstab redirect, not necessarily who was originally clicked/targeted. */
  readonly defenderId: string;
}

export interface BattleAttackLogEntry extends BattleLogEntryBase {
  readonly kind: 'attack';
  readonly amount: number;
  readonly defeated: boolean;
  /** True when this "hit" was Trudeau's heal-from-a-woman quirk restoring composure
   * instead of removing it — `amount` is still positive either way. */
  readonly healed?: boolean;
}

/** Trump's flee quirk: he backed out before the hit landed on anyone. */
export interface BattleFleeLogEntry extends BattleLogEntryBase {
  readonly kind: 'flee';
}

/** LeBlanc's dodge quirk: the hit whiffed entirely, no composure change. */
export interface BattleDodgeLogEntry extends BattleLogEntryBase {
  readonly kind: 'dodge';
}

/** Carney's Charm spell. `allyId` is unset if the charmed unit had no living ally left
 * to swing at (the charm just fizzles); otherwise `allyAmount`/`allyDefeated` describe
 * the forced friendly-fire hit. */
export interface BattleCharmLogEntry extends BattleLogEntryBase {
  readonly kind: 'charm';
  readonly allyId?: string;
  readonly allyAmount?: number;
  readonly allyDefeated?: boolean;
}

/** Melania's Sorcerer spell: a lingering power debuff, no direct damage. */
export interface BattleCurseLogEntry extends BattleLogEntryBase {
  readonly kind: 'curse';
}

export type BattleLogEntry =
  | BattleAttackLogEntry
  | BattleFleeLogEntry
  | BattleDodgeLogEntry
  | BattleCharmLogEntry
  | BattleCurseLogEntry;

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
    magicCharge: 0,
  }));
  const enemy: BattleUnit[] = enemySpawns.map((s) => ({
    ...s.template,
    side: 'enemy',
    composure: s.template.maxComposure,
    pos: s.pos,
    magicCharge: 0,
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

/** `power + a small seeded variance, never less than 1. Shared by a normal hit and
 * Carney's charm-forced friendly-fire strike. */
function rollDamage(rng: Rng, power: number): number {
  return Math.max(1, power + rng.int(-2, 2));
}

/** Immutably applies a composure change (negative = damage, positive = heal) to one
 * unit, clamped to `[0, maxComposure]`. */
function applyComposureDelta(
  units: readonly BattleUnit[],
  targetId: string,
  delta: number,
): readonly BattleUnit[] {
  return units.map((u) =>
    u.id === targetId
      ? { ...u, composure: Math.max(0, Math.min(u.maxComposure, u.composure + delta)) }
      : u,
  );
}

function setMagicCharge(
  units: readonly BattleUnit[],
  unitId: string,
  value: number,
): readonly BattleUnit[] {
  return units.map((u) => (u.id === unitId ? { ...u, magicCharge: value } : u));
}

/** Carney's Charm spell (see this file's doc comment): resolved immediately, not as a
 * status the target carries into their own later turn. */
function castCharm(
  state: BattleState,
  rng: Rng,
  caster: BattleUnit,
  target: BattleUnit,
): { readonly state: BattleState; readonly entry: BattleCharmLogEntry } {
  const allies = livingUnits(state, target.side).filter((u) => u.id !== target.id);
  let units = setMagicCharge(state.units, caster.id, 0);

  let entry: BattleCharmLogEntry = {
    kind: 'charm',
    attackerId: caster.id,
    defenderId: target.id,
  };

  if (allies.length > 0) {
    const ally = rng.pick(allies);
    const amount = rollDamage(rng, target.power);
    units = applyComposureDelta(units, ally.id, -amount);
    const allyAfter = units.find((u) => u.id === ally.id);
    entry = {
      ...entry,
      allyId: ally.id,
      allyAmount: amount,
      allyDefeated: (allyAfter?.composure ?? 0) <= 0,
    };
  }

  return { state: { ...state, units, rngState: rng.state, log: [...state.log, entry] }, entry };
}

/** Melania's Sorcerer spell (see this file's doc comment): a lingering power debuff
 * instead of a direct hit. */
function castCurse(
  state: BattleState,
  rng: Rng,
  caster: BattleUnit,
  target: BattleUnit,
): { readonly state: BattleState; readonly entry: BattleCurseLogEntry } {
  const cursedPower = Math.max(1, Math.round(target.power / 2));
  const units = setMagicCharge(state.units, caster.id, 0).map((u) =>
    u.id === target.id ? { ...u, power: cursedPower } : u,
  );
  const entry: BattleCurseLogEntry = { kind: 'curse', attackerId: caster.id, defenderId: target.id };
  return { state: { ...state, units, rngState: rng.state, log: [...state.log, entry] }, entry };
}

/** Regenerates 1 MP for `unitId` if it has a `magic` pool that isn't already full. A
 * no-op for a non-magic unit or one that's already charged (or just cast, in which case
 * a caller already reset it to 0 this same action — the *next* attack is what recharges
 * it, not this one). */
function rechargeMagic(state: BattleState, unitId: string): BattleState {
  return {
    ...state,
    units: state.units.map((u) =>
      u.id === unitId && u.magic && u.magicCharge < u.magic.max
        ? { ...u, magicCharge: u.magicCharge + 1 }
        : u,
    ),
  };
}

/**
 * `attackerId` attacks `defenderId` — or, once any personal quirk (see this file's doc
 * comment) has had its say, whatever actually ends up happening instead: a cast spell,
 * a flee, a redirected hit, a dodge, or a heal. Doesn't validate range — callers check
 * `targetsInRange`. Always logs exactly one entry and always ends with either a normal
 * `'attack'` or one of the quirk kinds; never a no-op.
 */
export function attack(
  state: BattleState,
  attackerId: string,
  defenderId: string,
): { readonly state: BattleState; readonly entry: BattleLogEntry } {
  const attacker = unitById(state, attackerId);
  const requestedDefender = unitById(state, defenderId);
  const rng = createRng(state.rngState);

  if (
    attacker.magic &&
    attacker.magicCharge >= attacker.magic.max &&
    rng.chance(attacker.magic.chance)
  ) {
    return attacker.magic.kind === 'charm'
      ? castCharm(state, rng, attacker, requestedDefender)
      : castCurse(state, rng, attacker, requestedDefender);
  }

  if (attacker.fleeChance !== undefined && rng.chance(attacker.fleeChance)) {
    const entry: BattleFleeLogEntry = { kind: 'flee', attackerId, defenderId };
    const next = rechargeMagic(
      { ...state, rngState: rng.state, log: [...state.log, entry] },
      attackerId,
    );
    return { state: next, entry };
  }

  let finalDefenderId = defenderId;
  if (attacker.selfHitChance !== undefined && rng.chance(attacker.selfHitChance)) {
    finalDefenderId = attackerId;
  } else if (attacker.backstabChance !== undefined && rng.chance(attacker.backstabChance)) {
    const allies = livingUnits(state, attacker.side).filter((u) => u.id !== attackerId);
    if (allies.length > 0) finalDefenderId = rng.pick(allies).id;
  }

  const defender = unitById(state, finalDefenderId);

  if (defender.dodgeChance !== undefined && rng.chance(defender.dodgeChance)) {
    const entry: BattleDodgeLogEntry = {
      kind: 'dodge',
      attackerId,
      defenderId: finalDefenderId,
    };
    const next = rechargeMagic(
      { ...state, rngState: rng.state, log: [...state.log, entry] },
      attackerId,
    );
    return { state: next, entry };
  }

  const amount = rollDamage(rng, attacker.power);
  const healed = Boolean(defender.healsFromWomen) && Boolean(attacker.isWoman);
  const units = applyComposureDelta(state.units, finalDefenderId, healed ? amount : -amount);
  const after = units.find((u) => u.id === finalDefenderId);
  const entry: BattleAttackLogEntry = {
    kind: 'attack',
    attackerId,
    defenderId: finalDefenderId,
    amount,
    defeated: !healed && (after?.composure ?? 0) <= 0,
    healed: healed || undefined,
  };
  const next = rechargeMagic(
    { ...state, units, rngState: rng.state, log: [...state.log, entry] },
    attackerId,
  );
  return { state: next, entry };
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
