import { useEffect, useState } from 'react';
import { getAction } from '@/data/actions';
import { displayName, getCharacter } from '@/data/characters';
import { getShowdownForAction } from '@/data/showdowns';
import { actionHasBattle } from '@/engine/battle';
import { summarizeEffects, type EffectSummary } from '@/engine/preview';
import { computeSuccessChance } from '@/engine/resolve';
import { totalShowdownModifier } from '@/engine/showdown';
import type { StatKey } from '@/engine/types';
import { useGameStore } from '@/store/gameStore';
import { playSfx } from '../audio/sfx';
import { BattleView } from '../battle/BattleView';
import { formatStatDelta, formatStatValue, REPORT_STAT_ORDER, statLabelKey } from '../format';
import { useT } from '../useT';
import type { TFunction } from '../useT';
import { SelectCountryScreen } from './SelectCountryScreen';

/** Felt inflation stays hidden here too (GAME_PLAN §4), same as the month-end report. */
const HIDDEN_PREVIEW_STATS = new Set<StatKey>(['feltInflation']);

function statEntries(
  totals: Readonly<Partial<Record<StatKey, number>>>,
): readonly (readonly [StatKey, number])[] {
  return (Object.entries(totals) as (readonly [StatKey, number])[]).filter(
    ([stat]) => !HIDDEN_PREVIEW_STATS.has(stat),
  );
}

function EffectPreviewList({ summary, t }: { summary: EffectSummary; t: TFunction }) {
  const immediate = statEntries(summary.immediate);
  const overTime = statEntries(summary.overTime);

  if (immediate.length === 0 && overTime.length === 0 && !summary.hasRandomCountry) {
    return <p className="preview-note">{t('resolution.noEffects')}</p>;
  }

  return (
    <ul className="preview-effects">
      {immediate.map(([stat, amount]) => (
        <li key={`now-${stat}`}>
          <span>{t(statLabelKey(stat))}</span>
          <span>{formatStatDelta(stat, amount)}</span>
        </li>
      ))}
      {overTime.map(([stat, amount]) => (
        <li key={`later-${stat}`} className="preview-effect-over-time">
          <span>{t(statLabelKey(stat))}</span>
          <span>
            {formatStatDelta(stat, amount)} {t('resolution.overTime')}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * The Phase 3 resolution flow (GAME_PLAN §7): an optional showdown, a preview the
 * player confirms, a brief roll, then the result. Renders nothing when no action is
 * currently being resolved.
 */
export function ResolutionOverlay() {
  const t = useT();
  const resolution = useGameStore((s) => s.resolution);
  const activeCharacter = useGameStore((s) => s.activeCharacter);
  const chooseShowdownOption = useGameStore((s) => s.chooseShowdownOption);
  const confirmPreview = useGameStore((s) => s.confirmPreview);
  const cancelResolution = useGameStore((s) => s.cancelResolution);
  const continueResolution = useGameStore((s) => s.continueResolution);

  const phase = resolution?.phase ?? null;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (phase !== 'result') return;
    setRevealed(false);
    const timer = setTimeout(() => {
      setRevealed(true);
      playSfx(resolution?.result?.success ? 'success' : 'fail');
    }, 900);
    return () => clearTimeout(timer);
  }, [phase, resolution?.actionId, resolution?.result?.success]);

  if (!resolution) return null;

  const action = getAction(resolution.actionId);
  const showdown = getShowdownForAction(resolution.actionId);
  const character = getCharacter(activeCharacter);

  if (resolution.phase === 'showdown' && showdown) {
    const roundIndex = resolution.showdownChoices.length;
    const round = showdown.rounds[roundIndex];
    if (!round) return null;

    return (
      <div className="menu-overlay resolution-overlay" role="dialog" aria-modal="true">
        <h2 className="menu-overlay-title">
          {t('resolution.showdownTitle', { n: roundIndex + 1, total: showdown.rounds.length })}
        </h2>
        <p className="showdown-prompt">{t(round.promptKey)}</p>
        <div className="showdown-choices">
          {round.choices.map((choice, index) => (
            <button
              key={index}
              type="button"
              className="pixel-button showdown-choice"
              onClick={() => {
                playSfx('blip');
                chooseShowdownOption(index);
              }}
            >
              {t(choice.labelKey)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (resolution.phase === 'preview') {
    const modifier = showdown ? totalShowdownModifier(showdown, resolution.showdownChoices) : 0;
    const chance = computeSuccessChance(action, modifier);
    const summary = summarizeEffects(action.onSuccess);
    const battleGated = actionHasBattle(action.id);

    return (
      <div className="menu-overlay resolution-overlay" role="dialog" aria-modal="true">
        <h2 className="menu-overlay-title">{t('resolution.previewTitle')}</h2>
        <div className="preview-header">
          <img
            className="official-portrait"
            src={character.sprite.front}
            alt=""
            aria-hidden="true"
          />
          <span className="preview-official-name">{displayName(activeCharacter)}</span>
        </div>
        <p className="preview-action-name">{t(action.nameKey)}</p>
        {battleGated ? (
          <p className="preview-note">{t('battle.previewNote')}</p>
        ) : (
          <p className="preview-chance">{t('resolution.successChance', { n: chance })}</p>
        )}
        <EffectPreviewList summary={summary} t={t} />
        {summary.hasChance && <p className="preview-note">{t('resolution.hasChanceNote')}</p>}
        {summary.hasRandomCountry && !battleGated && (
          <p className="preview-note">{t('resolution.randomCountryNote')}</p>
        )}
        {battleGated && <p className="preview-note">{t('battle.selectCountryNote')}</p>}
        <div className="preview-buttons">
          <button
            type="button"
            className="pixel-button"
            onClick={() => {
              playSfx('cancel');
              cancelResolution();
            }}
          >
            {t('resolution.cancel')}
          </button>
          <button
            type="button"
            className="pixel-button"
            onClick={() => {
              playSfx('confirm');
              confirmPreview();
            }}
          >
            {t('resolution.confirm')}
          </button>
        </div>
      </div>
    );
  }

  if (resolution.phase === 'selectCountry') {
    return <SelectCountryScreen />;
  }

  if (resolution.phase === 'battle') {
    return <BattleView />;
  }

  if (resolution.phase === 'result') {
    if (!revealed) {
      return (
        <div className="menu-overlay resolution-overlay" role="dialog" aria-modal="true">
          <p className="rolling-text">{t('resolution.rolling')}</p>
        </div>
      );
    }

    const { result, nextGame, statsBefore } = resolution;
    if (!result || !nextGame) return null;

    return (
      <div className="menu-overlay resolution-overlay" role="dialog" aria-modal="true">
        <h2
          className={
            result.success ? 'resolution-verdict is-success' : 'resolution-verdict is-fail'
          }
        >
          {t(result.success ? 'resolution.success' : 'resolution.fail')}
        </h2>
        <p className="resolution-headline">
          {t('resolution.headline', { action: t(action.nameKey), n: result.headlines })}
        </p>
        <table className="report-stats">
          <tbody>
            {REPORT_STAT_ORDER.map((stat) => (
              <tr key={stat}>
                <th scope="row">{t(statLabelKey(stat))}</th>
                <td>{formatStatValue(stat, nextGame.stats[stat])}</td>
                <td className="report-delta">
                  {formatStatDelta(stat, nextGame.stats[stat] - statsBefore[stat])}
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
            continueResolution();
          }}
        >
          {t('resolution.continue')}
        </button>
      </div>
    );
  }

  return null;
}
