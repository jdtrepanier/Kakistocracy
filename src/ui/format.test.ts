import { describe, expect, it } from 'vitest';
import { translate } from '@/i18n/translate';
import {
  formatDate,
  formatDebt,
  formatPercent,
  formatStatDelta,
  formatStatValue,
  formatWholePercent,
  REPORT_STAT_ORDER,
  statLabelKey,
} from './format';
import { computeStageScale } from './useStageScale';

describe('format', () => {
  it('formats HUD values', () => {
    expect(formatDebt(40)).toBe('$40.0T');
    expect(formatDebt(51.04)).toBe('$51.0T');
    expect(formatPercent(3.5)).toBe('3.5%');
    expect(formatWholePercent(69.6)).toBe('70%');
  });

  it('formats the calendar date in both languages', () => {
    const date = { year: 2024, month: 1 };
    expect(formatDate((key, params) => translate('en', key, params), date)).toBe('JAN 2024');
    expect(formatDate((key, params) => translate('fr', key, params), date)).toBe('JANV 2024');
  });
});

describe('formatStatValue', () => {
  it('formats each stat with its usual unit', () => {
    expect(formatStatValue('debt', 42.5)).toBe('$42.5T');
    expect(formatStatValue('interestRate', 3.5)).toBe('3.5%');
    expect(formatStatValue('happiness', 69.9)).toBe('70%');
    expect(formatStatValue('iq', 77.6)).toBe('78');
    expect(formatStatValue('defcon', 3)).toBe('3');
    expect(formatStatValue('headlines', 40)).toBe('40');
  });
});

describe('formatStatDelta', () => {
  it('signs positive and negative changes', () => {
    expect(formatStatDelta('debt', 1.7)).toBe('+1.7');
    expect(formatStatDelta('debt', -0.3)).toBe('-0.3');
    expect(formatStatDelta('iq', -5)).toBe('-5');
    expect(formatStatDelta('happiness', 10)).toBe('+10');
  });

  it('shows an unsigned zero for no real change', () => {
    expect(formatStatDelta('iq', 0)).toBe('0');
    expect(formatStatDelta('debt', 0.004)).toBe('0.0');
  });
});

describe('statLabelKey / REPORT_STAT_ORDER', () => {
  it('gives every reported stat a HUD label key, and hides felt inflation', () => {
    expect(REPORT_STAT_ORDER).not.toContain('feltInflation');
    for (const stat of REPORT_STAT_ORDER) {
      expect(statLabelKey(stat)).toMatch(/^hud\./);
    }
  });
});

describe('computeStageScale', () => {
  it('uses whole-number zoom when the window is bigger than the stage', () => {
    expect(computeStageScale(1920, 1080)).toBe(4);
    expect(computeStageScale(1366, 768)).toBe(2);
    expect(computeStageScale(480, 270)).toBe(1);
  });

  it('shrinks to fit on small screens', () => {
    expect(computeStageScale(400, 800)).toBeCloseTo(400 / 480);
  });
});
