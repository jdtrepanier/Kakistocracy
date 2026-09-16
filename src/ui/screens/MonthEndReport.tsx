import { useEffect } from 'react';
import { getAction } from '@/data/actions';
import { BALANCE } from '@/data/balance';
import { isSameMonth } from '@/engine/calendar';
import { useGameStore } from '@/store/gameStore';
import { playSfx } from '../audio/sfx';
import {
  formatDate,
  formatStatDelta,
  formatStatValue,
  REPORT_STAT_ORDER,
  statLabelKey,
} from '../format';
import { useT } from '../useT';

/** Full-screen summary shown right after End Month: what happened, and the new stats. */
export function MonthEndReport() {
  const t = useT();
  const report = useGameStore((s) => s.monthReport);
  const game = useGameStore((s) => s.game);
  const continueFromReport = useGameStore((s) => s.continueFromReport);

  useEffect(() => {
    if (report) playSfx('headline');
  }, [report]);

  if (!report) return null;

  // The month that just ended is the midterms month (GAME_PLAN §3) exactly when
  // `game.congressLost`/`midtermsChecked` were just decided by this same `tickMonth`
  // call — `game` already reflects the post-tick result, so no extra state is needed
  // here to show the outcome once, right when it happens.
  const justHadMidterms = isSameMonth(report.date, BALANCE.calendar.midterms);
  const impeachmentWatch =
    game.congressLost && !justHadMidterms && game.lowHappinessStreak > 0 && !game.ending;

  return (
    <div className="report-overlay" role="dialog" aria-modal="true">
      <h2 className="report-title">{t('report.title', { date: formatDate(t, report.date) })}</h2>

      {justHadMidterms && (
        <section className="report-section report-midterms" aria-label={t('report.midterms')}>
          <p>{t(game.congressLost ? 'report.midterms.lost' : 'report.midterms.won')}</p>
        </section>
      )}

      {impeachmentWatch && (
        <section
          className="report-section report-impeachment-watch"
          aria-label={t('report.impeachmentWarning')}
        >
          <p>
            {t('report.impeachmentWarning', {
              n: game.lowHappinessStreak,
              total: BALANCE.thresholds.impeachmentStreakMonths,
            })}
          </p>
        </section>
      )}

      <section className="report-section" aria-label={t('report.actionsThisMonth')}>
        {report.entries.length === 0 ? (
          <p className="report-empty">{t('report.noActions')}</p>
        ) : (
          <ul className="report-actions">
            {report.entries.map((entry, i) => (
              <li
                key={i}
                className={entry.success ? 'report-action is-success' : 'report-action is-fail'}
              >
                <span>{t(getAction(entry.actionId).nameKey)}</span>
                <span>{t(entry.success ? 'report.success' : 'report.fail')}</span>
                <span>+{entry.headlines}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {report.event && (
        <section className="report-section report-event" aria-label={t('report.eventLabel')}>
          <p>📰 {t(report.event.event.nameKey)}</p>
        </section>
      )}

      <table className="report-stats">
        <tbody>
          {REPORT_STAT_ORDER.map((stat) => (
            <tr key={stat}>
              <th scope="row">{t(statLabelKey(stat))}</th>
              <td>{formatStatValue(stat, report.statsAfter[stat])}</td>
              <td className="report-delta">
                {formatStatDelta(stat, report.statsAfter[stat] - report.statsBefore[stat])}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        className="pixel-button report-continue"
        onClick={() => {
          playSfx('blip');
          continueFromReport();
        }}
      >
        {t('report.continue')}
      </button>
    </div>
  );
}
