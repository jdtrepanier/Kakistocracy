import { useEffect } from 'react';
import { getAction } from '@/data/actions';
import { BALANCE, getBalance } from '@/data/balance';
import { isSameMonth } from '@/engine/calendar';
import { useGameStore } from '@/store/gameStore';
import { playSfx } from '../audio/sfx';
import { formatDate } from '../format';
import { useT } from '../useT';
import { ReportStatsTable } from './ReportStatsTable';

/** Full-screen summary shown right after End Month: what happened, and the new stats. */
export function MonthEndReport() {
  const t = useT();
  const report = useGameStore((s) => s.monthReport);
  const game = useGameStore((s) => s.game);
  const difficulty = useGameStore((s) => s.difficulty);
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
              // Real bug found on a polish pass: this used to read the always-Normal
              // `BALANCE` constant directly (Normal's threshold is 3), so an Intern run
              // (threshold 4) or Third Term run (threshold 2) always showed the wrong
              // denominator here — off by one in either direction depending on which
              // non-Normal difficulty was picked. `getBalance(difficulty)` is the same
              // fix `Hud.tsx`'s Executive Action pips needed for the identical reason.
              n: game.lowHappinessStreak,
              total: getBalance(difficulty).thresholds.impeachmentStreakMonths,
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

      <ReportStatsTable statsBefore={report.statsBefore} statsAfter={report.statsAfter} />

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
