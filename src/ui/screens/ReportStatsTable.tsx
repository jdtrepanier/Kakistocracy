import type { NationStats, StatKey } from '@/engine/types';
import { formatStatDelta, formatStatValue, REPORT_STAT_ORDER, statLabelKey } from '../format';
import { useT } from '../useT';
import { useTickUp } from '../useTickUp';

/** One row: the stat's own tick-up animation from `before` to `after` (GAME_PLAN §16/§17
 * "juice"), formatted the same way the settled value always was. */
function StatRow({ stat, before, after }: { stat: StatKey; before: number; after: number }) {
  const t = useT();
  const displayed = useTickUp(before, after);
  return (
    <tr>
      <th scope="row">{t(statLabelKey(stat))}</th>
      <td>{formatStatValue(stat, displayed)}</td>
      <td className="report-delta">{formatStatDelta(stat, after - before)}</td>
    </tr>
  );
}

/**
 * The stat table shared by the month-end report and the action-result screen — same
 * three columns (label, new value, delta) either way, so extracted rather than kept as
 * two copies of the same JSX. Each row counts up on its own from `statsBefore` to
 * `statsAfter` when it first mounts.
 */
export function ReportStatsTable({
  statsBefore,
  statsAfter,
}: {
  statsBefore: NationStats;
  statsAfter: NationStats;
}) {
  return (
    <table className="report-stats">
      <tbody>
        {REPORT_STAT_ORDER.map((stat) => (
          <StatRow key={stat} stat={stat} before={statsBefore[stat]} after={statsAfter[stat]} />
        ))}
      </tbody>
    </table>
  );
}
