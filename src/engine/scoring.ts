import type { Balance } from '@/data/balance';

/** Final rank on the "Survived" ending, from total Headlines (GAME_PLAN §5). */
export type Rank = 'forgettable' | 'memorable' | 'historic' | 'legendary';

const RANKS: readonly Rank[] = ['forgettable', 'memorable', 'historic', 'legendary'];

export function computeRank(headlines: number, balance: Balance): Rank {
  const index = balance.rankThresholds.filter((threshold) => headlines >= threshold).length;
  return RANKS[index] ?? 'legendary';
}
