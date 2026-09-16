import type { GameDate, StatKey } from '@/engine/types';
import { monthKey, type MessageKey, type TranslateParams } from '@/i18n/translate';

type Translate = (key: MessageKey, params?: TranslateParams) => string;

/** 40 → "$40.0T" */
export function formatDebt(trillions: number): string {
  return `$${trillions.toFixed(1)}T`;
}

/** 3.5 → "3.5%" */
export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

/** 69.6 → "70%" */
export function formatWholePercent(value: number): string {
  return `${Math.round(value)}%`;
}

/** { year: 2024, month: 1 } → "JAN 2024" (or "JANV 2024" in French) */
export function formatDate(t: Translate, date: GameDate): string {
  return `${t(monthKey(date.month))} ${date.year}`;
}

/** Decimal places each stat is displayed with (whole numbers for IQ, DEFCON, Headlines). */
const STAT_DIGITS: Readonly<Record<StatKey, number>> = {
  debt: 1,
  interestRate: 1,
  inflation: 1,
  feltInflation: 1,
  iq: 0,
  happiness: 0,
  defcon: 0,
  headlines: 0,
};

/** The HUD label key for each stat shown in the month-end report. Felt inflation stays hidden. */
export const REPORT_STAT_ORDER: readonly StatKey[] = [
  'debt',
  'interestRate',
  'inflation',
  'iq',
  'happiness',
  'defcon',
  'headlines',
];

const STAT_LABEL_KEY: Readonly<Record<StatKey, MessageKey>> = {
  debt: 'hud.debt',
  interestRate: 'hud.rate',
  inflation: 'hud.inflation',
  feltInflation: 'hud.inflation',
  iq: 'hud.iq',
  happiness: 'hud.happiness',
  defcon: 'hud.defcon',
  headlines: 'hud.headlines',
};

export function statLabelKey(stat: StatKey): MessageKey {
  return STAT_LABEL_KEY[stat];
}

/** One stat's current value, formatted with its usual unit (debt in $T, most others in %). */
export function formatStatValue(stat: StatKey, value: number): string {
  if (stat === 'debt') return formatDebt(value);
  if (stat === 'interestRate' || stat === 'inflation' || stat === 'feltInflation') {
    return formatPercent(value, STAT_DIGITS[stat]);
  }
  if (stat === 'happiness') return formatWholePercent(value);
  return String(Math.round(value));
}

/** A signed change in one stat, e.g. "+1.7" or "-3". Zero (after rounding) reads as "0". */
export function formatStatDelta(stat: StatKey, delta: number): string {
  const digits = STAT_DIGITS[stat];
  const rounded = Number(delta.toFixed(digits));
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(digits)}`;
}
