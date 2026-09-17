import type { ReactNode } from 'react';
import { BALANCE, getBalance } from '@/data/balance';
import { termYear } from '@/engine/calendar';
import { useGameStore } from '@/store/gameStore';
import { formatDate, formatDebt, formatPercent, formatWholePercent } from '../format';
import { useT } from '../useT';

interface HudCellProps {
  label: ReactNode;
  value: ReactNode;
  title?: string;
  className?: string;
}

function HudCell({ label, value, title, className }: HudCellProps) {
  return (
    <div className={className ? `hud-cell ${className}` : 'hud-cell'} title={title}>
      <span className="hud-label">{label}</span>
      <span className="hud-value">{value}</span>
    </div>
  );
}

/** Four segments, one per year of the term. */
function TermBar({ year }: { year: number }) {
  return (
    <span className="term-bar" aria-hidden="true">
      {[1, 2, 3, 4].map((y) => (
        <span key={y} className={y <= year ? 'term-seg is-filled' : 'term-seg'} />
      ))}
    </span>
  );
}

/** Gavel pips: Executive Actions left this month. */
function ActionPips({ left, total }: { left: number; total: number }) {
  return (
    <span className="action-pips" aria-label={`${left}/${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < left ? 'pip is-on' : 'pip'} />
      ))}
    </span>
  );
}

export function Hud() {
  const t = useT();
  const game = useGameStore((s) => s.game);
  const difficulty = useGameStore((s) => s.difficulty);
  const { stats, date } = game;
  // `calendar` never varies by difficulty (`data/balance.ts`'s `BALANCES` doc comment:
  // only how forgiving a run is changes, not its shape), so `BALANCE.calendar.start`
  // stays correct here regardless of difficulty. `actionsPerMonth` below is a different
  // story — Intern is 4/month, Third Term is 2 — so that one has to go through
  // `getBalance(difficulty)` instead of the always-Normal `BALANCE` constant.
  const year = termYear(date, BALANCE.calendar.start);
  const felt = game.feltInflationRevealed ? formatPercent(stats.feltInflation) : t('hud.hidden');

  return (
    <header className="hud" aria-label={t('hud.label')}>
      <HudCell
        className="hud-date"
        label={
          <>
            {t('hud.date')}
            <TermBar year={year} />
          </>
        }
        value={formatDate(t, date)}
        title={t('hud.termYear', { n: year })}
      />
      <HudCell label={t('hud.debt')} value={formatDebt(stats.debt)} />
      <HudCell label={t('hud.rate')} value={formatPercent(stats.interestRate)} />
      <HudCell
        label={t('hud.inflation')}
        value={
          <>
            {formatPercent(stats.inflation)} <span className="hud-felt">{felt}</span>
          </>
        }
      />
      <HudCell label={t('hud.iq')} value={Math.round(stats.iq)} />
      <HudCell label={t('hud.happiness')} value={formatWholePercent(stats.happiness)} />
      <HudCell
        className={`hud-defcon defcon-${stats.defcon}`}
        label={t('hud.defcon')}
        value={stats.defcon}
      />
      <HudCell
        label={t('hud.actions')}
        value={
          <ActionPips left={game.actionsLeft} total={getBalance(difficulty).actionsPerMonth} />
        }
      />
      <HudCell label={t('hud.headlines')} value={Math.round(stats.headlines)} />
      {game.congressLost && (
        <HudCell
          className="hud-congress"
          label={t('hud.congress')}
          value={t('hud.congress.lost')}
          title={t('hud.congress.title')}
        />
      )}
    </header>
  );
}
