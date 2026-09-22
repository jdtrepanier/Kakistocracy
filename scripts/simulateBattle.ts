/**
 * Tactical-battle balance simulator (companion to `scripts/simulate.ts`'s economy Monte
 * Carlo, same "pure logic, runnable directly with `tsx`, no vitest import" shape). Plays
 * out thousands of full US-vs-country battles using the real `engine/battle.ts` combat
 * resolution and the real `data/battleRosters.ts` / `data/battlefield.ts` data — built to
 * answer, empirically rather than by eyeballing stat tables, a specific piece of user
 * feedback: "it's almost impossible to win a battle against Canada."
 *
 * The engine itself has no player-facing "AI" (a human clicks tiles and targets); to
 * simulate the US side, `takeTurnAI` below mirrors `engine/battle.ts`'s own
 * `enemyTakeTurn` heuristic ("attack the weakest target in range, else close the
 * distance") but generalized to work for either side — using the *same* heuristic for
 * both sides keeps the comparison fair: neither side's simulated player is smarter than
 * the other, so a lopsided win rate reflects the roster/stat data, not AI skill.
 */
import {
  attack,
  checkOutcome,
  createBattle,
  currentUnit,
  endTurn,
  livingUnits,
  moveUnit,
  reachableTiles,
  targetsInRange,
  unitById,
  type BattleSide,
  type BattleSpawn,
  type BattleState,
} from '@/engine/battle';
import { US_BATTLE_UNITS, getBattleRoster } from '@/data/battleRosters';
import { getBattleground } from '@/data/battlegrounds';
import { createRng } from '@/engine/rng';
import type { CountryId, GridPosition } from '@/engine/types';

export const ITERATIONS = 2000;
const MAX_TURNS = 400; // safety cap against an unexpected infinite stalemate

function manhattan(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function opponentSide(side: BattleSide): BattleSide {
  return side === 'us' ? 'enemy' : 'us';
}

/** Generalized version of `engine/battle.ts`'s `enemyTakeTurn`: attack the weakest living
 * opponent in range, else close the distance toward the nearest one. Used for *both*
 * sides here so the simulated US player is exactly as "smart" as the real enemy AI. */
function takeTurnAI(state: BattleState, unitId: string): BattleState {
  const unit = unitById(state, unitId);
  if (unit.composure <= 0) return state;

  let working = state;
  if (targetsInRange(working, unitId).length === 0) {
    const targets = livingUnits(working, opponentSide(unit.side));
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

export interface BattleRunResult {
  readonly outcome: 'usWin' | 'enemyWin' | 'ongoing';
  readonly rounds: number;
  readonly usSurvivors: number;
  readonly enemySurvivors: number;
}

export function runBattle(seed: number, country: CountryId): BattleRunResult {
  // Per-country battleground (`data/battlegrounds.ts`) — a real playable grid/spawn set,
  // not just visual dressing, for Canada's river-and-bridge layout; every other country
  // still resolves to `DEFAULT_BATTLEGROUND`, which wraps the exact same shared
  // grid/spawns this simulator always used, so their numbers are unaffected.
  const battleground = getBattleground(country);
  const usSpawns: readonly BattleSpawn[] = Object.values(US_BATTLE_UNITS).map((template, i) => ({
    template,
    pos: battleground.usSpawns[i] as GridPosition,
  }));
  const enemySpawns: readonly BattleSpawn[] = getBattleRoster(country).map((template, i) => ({
    template,
    pos: battleground.enemySpawns[i] as GridPosition,
  }));

  let state = createBattle(battleground.grid, usSpawns, enemySpawns, seed);
  let turns = 0;
  while (checkOutcome(state) === 'ongoing' && turns < MAX_TURNS) {
    const unit = currentUnit(state);
    state = takeTurnAI(state, unit.id);
    state = endTurn(state);
    turns++;
  }

  return {
    outcome: checkOutcome(state),
    rounds: state.round,
    usSurvivors: livingUnits(state, 'us').length,
    enemySurvivors: livingUnits(state, 'enemy').length,
  };
}

export interface BattleReport {
  readonly country: CountryId;
  readonly iterations: number;
  readonly usWins: number;
  readonly enemyWins: number;
  readonly stalemates: number;
  readonly avgRounds: number;
  readonly avgUsSurvivorsOnWin: number;
  readonly avgEnemySurvivorsOnWin: number;
}

export function simulate(country: CountryId, iterations = ITERATIONS): BattleReport {
  let usWins = 0;
  let enemyWins = 0;
  let stalemates = 0;
  let roundsTotal = 0;
  let usSurvivorsOnWinTotal = 0;
  let enemySurvivorsOnWinTotal = 0;

  // Independent seed stream, decorrelated from any other simulator's seeds, still
  // reproducible.
  const seedRng = createRng(0xc0ffee ^ country.length);
  for (let i = 0; i < iterations; i++) {
    const seed = seedRng.int(1, 2 ** 31 - 1);
    const result = runBattle(seed, country);
    roundsTotal += result.rounds;
    if (result.outcome === 'usWin') {
      usWins++;
      usSurvivorsOnWinTotal += result.usSurvivors;
    } else if (result.outcome === 'enemyWin') {
      enemyWins++;
      enemySurvivorsOnWinTotal += result.enemySurvivors;
    } else {
      stalemates++;
    }
  }

  return {
    country,
    iterations,
    usWins,
    enemyWins,
    stalemates,
    avgRounds: roundsTotal / iterations,
    avgUsSurvivorsOnWin: usWins > 0 ? usSurvivorsOnWinTotal / usWins : 0,
    avgEnemySurvivorsOnWin: enemyWins > 0 ? enemySurvivorsOnWinTotal / enemyWins : 0,
  };
}

export function printReport(report: BattleReport): void {
  const winRate = ((report.usWins / report.iterations) * 100).toFixed(1);
  console.log(`\n=== ${report.country} (${report.iterations} battles) ===`);
  console.log(`US win rate:      ${winRate}%  (${report.usWins}/${report.iterations})`);
  console.log(
    `Enemy win rate:   ${((report.enemyWins / report.iterations) * 100).toFixed(1)}%  (${report.enemyWins}/${report.iterations})`,
  );
  if (report.stalemates > 0)
    console.log(`Stalemates (hit ${MAX_TURNS}-turn cap): ${report.stalemates}`);
  console.log(`Avg rounds/battle: ${report.avgRounds.toFixed(1)}`);
  console.log(`Avg US survivors on a US win:    ${report.avgUsSurvivorsOnWin.toFixed(2)}`);
  console.log(`Avg enemy survivors on an enemy win: ${report.avgEnemySurvivorsOnWin.toFixed(2)}`);
}

// Run directly (`tsx scripts/simulateBattle.ts`) against every war-eligible country, so
// Canada's number can be read next to its neighbors rather than in isolation.
if (import.meta.url === `file://${process.argv[1]}`) {
  const countries: readonly CountryId[] = [
    'canada',
    'greenland',
    'panama',
    'mexico',
    'iran',
    'venezuela',
    'russia',
  ];
  for (const country of countries) {
    printReport(simulate(country));
  }
}
