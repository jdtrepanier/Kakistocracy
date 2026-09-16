import type { GameDate } from './types';

/** Returns the date `months` months after `date` (negative values go back in time). */
export function addMonths(date: GameDate, months: number): GameDate {
  const index = date.year * 12 + (date.month - 1) + months;
  const month = ((index % 12) + 12) % 12;
  return { year: (index - month) / 12, month: month + 1 };
}

/** Whole months from `from` to `to` (0 if same month, negative if `to` is earlier). */
export function monthsBetween(from: GameDate, to: GameDate): number {
  return (to.year - from.year) * 12 + (to.month - from.month);
}

export function isSameMonth(a: GameDate, b: GameDate): boolean {
  return a.year === b.year && a.month === b.month;
}

/** 1-based month of the term: the start month is month 1. */
export function termMonth(date: GameDate, start: GameDate): number {
  return monthsBetween(start, date) + 1;
}

/** 1-based year of the term (1–4 for a 48-month term). */
export function termYear(date: GameDate, start: GameDate): number {
  return Math.floor((termMonth(date, start) - 1) / 12) + 1;
}

/** True during the final month of the term (surviving its month-end wins the game). */
export function isFinalMonth(date: GameDate, start: GameDate, termMonths: number): boolean {
  return termMonth(date, start) === termMonths;
}
