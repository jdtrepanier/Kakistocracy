import { describe, expect, it } from 'vitest';
import { BALANCE } from '@/data/balance';
import {
  addMonths,
  isFinalMonth,
  isSameMonth,
  monthsBetween,
  termMonth,
  termYear,
} from './calendar';

const START = BALANCE.calendar.start;

describe('calendar', () => {
  it('starts the term in January 2024', () => {
    expect(START).toEqual({ year: 2024, month: 1 });
  });

  it('adds months across year boundaries', () => {
    expect(addMonths({ year: 2024, month: 11 }, 1)).toEqual({ year: 2024, month: 12 });
    expect(addMonths({ year: 2024, month: 12 }, 1)).toEqual({ year: 2025, month: 1 });
    expect(addMonths(START, 47)).toEqual({ year: 2027, month: 12 });
    expect(addMonths({ year: 2025, month: 1 }, -1)).toEqual({ year: 2024, month: 12 });
  });

  it('counts months between dates', () => {
    expect(monthsBetween(START, START)).toBe(0);
    expect(monthsBetween(START, { year: 2027, month: 12 })).toBe(47);
    expect(monthsBetween({ year: 2025, month: 3 }, START)).toBe(-14);
  });

  it('compares months', () => {
    expect(isSameMonth(START, { year: 2024, month: 1 })).toBe(true);
    expect(isSameMonth(START, { year: 2025, month: 1 })).toBe(false);
  });

  it('numbers months and years of the term from 1', () => {
    expect(termMonth(START, START)).toBe(1);
    expect(termMonth({ year: 2027, month: 12 }, START)).toBe(48);
    expect(termYear(START, START)).toBe(1);
    expect(termYear({ year: 2024, month: 12 }, START)).toBe(1);
    expect(termYear({ year: 2025, month: 1 }, START)).toBe(2);
    expect(termYear({ year: 2027, month: 12 }, START)).toBe(4);
  });

  it('knows when the final month of the term is reached', () => {
    const termMonths = BALANCE.calendar.termMonths;
    expect(isFinalMonth({ year: 2027, month: 11 }, START, termMonths)).toBe(false);
    expect(isFinalMonth({ year: 2027, month: 12 }, START, termMonths)).toBe(true);
  });
});
