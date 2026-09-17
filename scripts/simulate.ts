/**
 * Balance simulator (GAME_PLAN roadmap, Phase 1, folder structure §"scripts/simulate.ts"):
 * plays thousands of full terms with a couple of simple policies and reports survival
 * rate, ending breakdown and average Headlines.
 *
 * Pure logic lives here, with no `vitest` import, so it can be run directly with any
 * TS-capable runner (`tsx scripts/simulate.ts`) for a quick human-readable report with no
 * test framework involved. `scripts/simulate.test.ts` imports `simulate`/`printReport`
 * from this file and wraps them in the two Vitest assertions that catch a balance change
 * gone too far — that's what `yarn simulate` actually runs, and it prints the same report
 * along the way (Vitest doesn't swallow `console.log`).
 */
import { ACTIONS } from '@/data/actions';
import { BALANCE } from '@/data/balance';
import { checkAvailability, type ActionDef } from '@/engine/actions';
import { tickMonth } from '@/engine/economy';
import { createRng, type Rng } from '@/engine/rng';
import { resolveAction } from '@/engine/resolve';
import { createInitialState } from '@/engine/state';
import type { EndingId, GameState } from '@/engine/types';

export const ITERATIONS = 3000;

// A "careful" player never reaches for these on their own — they're the spectacular,
// IQ-gated, high-risk plays (GAME_PLAN §1: "dumber is stronger, until it isn't").
const RECKLESS_ACTION_IDS = new Set([
  'declare_war',
  'declare_war_object',
  'buy_country',
  'fire_fed_chair',
  'mint_platinum_coin',
]);

export type Policy = 'random' | 'cautious';

function availableActions(game: GameState): readonly ActionDef[] {
  return ACTIONS.filter((action) => checkAvailability(action, game).ok);
}

/** Picks one action to perform this turn, or `null` to stop spending EA this month. */
function pickAction(game: GameState, policy: Policy, rng: Rng): ActionDef | null {
  const available = availableActions(game);
  if (available.length === 0) return null;

  if (policy === 'random') return rng.pick(available);

  // 'cautious': patch the most urgent problem first, otherwise avoid the reckless plays.
  if (game.stats.iq < 25) {
    const briefing = available.find((a) => a.id === 'read_briefing');
    if (briefing) return briefing;
  }
  if (game.stats.defcon <= 2) {
    const summit = available.find((a) => a.id === 'summit');
    if (summit) return summit;
  }
  if (game.stats.happiness < 25) {
    const rally = available.find((a) => a.id === 'rally');
    if (rally) return rally;
  }
  const safe = available.filter((a) => !RECKLESS_ACTION_IDS.has(a.id));
  return rng.pick(safe.length > 0 ? safe : available);
}

export interface RunResult {
  readonly ending: EndingId;
  readonly months: number;
  readonly headlines: number;
}

export function runOne(seed: number, policy: Policy): RunResult {
  let game = createInitialState(seed);
  // A second, independent RNG stream for policy choices — decorrelated from the engine's
  // own success-roll RNG (state.rngState), but still seeded, so a report is reproducible.
  const policyRng = createRng((seed ^ 0x9e3779b9) >>> 0);
  let months = 0;
  const maxMonths = BALANCE.calendar.termMonths + 1;

  while (!game.ending && months < maxMonths) {
    while (game.actionsLeft > 0 && !game.ending) {
      const action = pickAction(game, policy, policyRng);
      if (!action) break;
      game = resolveAction(game, action).state;
    }
    if (game.ending) break;
    game = tickMonth(game);
    months++;
  }

  return { ending: game.ending ?? 'survived', months, headlines: game.stats.headlines };
}

export interface PolicyReport {
  readonly policy: Policy;
  readonly runs: number;
  readonly endingCounts: Readonly<Record<EndingId, number>>;
  readonly survivalRate: number;
  readonly avgMonths: number;
  readonly avgHeadlinesIfSurvived: number;
}

export function simulate(policy: Policy, iterations: number): PolicyReport {
  const endingCounts: Record<EndingId, number> = {
    bankruptcy: 0,
    revolt: 0,
    nuclear: 0,
    hyperinflation: 0,
    brainFreeze: 0,
    impeachment: 0,
    survived: 0,
  };
  let totalMonths = 0;
  let survivedHeadlines = 0;
  let survivedCount = 0;

  for (let seed = 0; seed < iterations; seed++) {
    const result = runOne(seed, policy);
    endingCounts[result.ending]++;
    totalMonths += result.months;
    if (result.ending === 'survived') {
      survivedCount++;
      survivedHeadlines += result.headlines;
    }
  }

  return {
    policy,
    runs: iterations,
    endingCounts,
    survivalRate: survivedCount / iterations,
    avgMonths: totalMonths / iterations,
    avgHeadlinesIfSurvived: survivedCount > 0 ? survivedHeadlines / survivedCount : 0,
  };
}

export function printReport(report: PolicyReport): void {
  console.log(`\nPolicy: ${report.policy} (${report.runs} runs)`);
  console.log(`  Survived:        ${(report.survivalRate * 100).toFixed(1)}%`);
  console.log(`  Avg months:      ${report.avgMonths.toFixed(1)} / ${BALANCE.calendar.termMonths}`);
  console.log(`  Avg Headlines (survivors): ${report.avgHeadlinesIfSurvived.toFixed(0)}`);
  console.log('  Cause of loss:');
  for (const [ending, count] of Object.entries(report.endingCounts)) {
    if (ending === 'survived' || count === 0) continue;
    console.log(`    ${ending.padEnd(15)} ${((count / report.runs) * 100).toFixed(1)}%`);
  }
}

// Runs and prints both policies' reports when this file is executed directly (`tsx
// scripts/simulate.ts` or `node --import tsx scripts/simulate.ts`), with no Vitest
// involved — `import.meta.url` matching the invoked script path is the standard ESM
// "is this the entry point" check.
if (import.meta.url === `file://${process.argv[1]}`) {
  printReport(simulate('random', ITERATIONS));
  printReport(simulate('cautious', ITERATIONS));
}
