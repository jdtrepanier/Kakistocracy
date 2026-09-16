import { describe, expect, it } from 'vitest';
import type { MessageKey } from '@/i18n/en';
import { checkAvailability, type ActionDef } from './actions';
import { createInitialState } from './state';
import type { GameState } from './types';

const ACTION: ActionDef = {
  id: 'test_action',
  // Not a real content key: this is a throwaway fixture, not shown in any UI.
  nameKey: 'action.test.name' as MessageKey,
  actors: ['trump'],
  room: 'ovalOffice',
  cost: { ea: 2 },
  baseSuccess: 80,
  onSuccess: [],
  onFail: [],
  headlines: 10,
};

describe('checkAvailability', () => {
  it('is available with default state (enough EA, no IQ gate, no limit)', () => {
    expect(checkAvailability(ACTION, createInitialState(1))).toEqual({ ok: true });
  });

  it('is unavailable once the run has ended', () => {
    const state: GameState = { ...createInitialState(1), ending: 'bankruptcy' };
    expect(checkAvailability(ACTION, state)).toEqual({ ok: false, reason: 'ended' });
  });

  it('is unavailable when Party IQ is above the requirement', () => {
    const gated: ActionDef = { ...ACTION, requires: { iqMax: 50 } };
    expect(checkAvailability(gated, createInitialState(1))).toEqual({ ok: false, reason: 'iq' });
    const lowIq: GameState = { ...createInitialState(1) };
    const withLowIq: GameState = { ...lowIq, stats: { ...lowIq.stats, iq: 50 } };
    expect(checkAvailability(gated, withLowIq)).toEqual({ ok: true });
  });

  it('is unavailable without enough Executive Actions', () => {
    const state: GameState = { ...createInitialState(1), actionsLeft: 1 };
    expect(checkAvailability(ACTION, state)).toEqual({ ok: false, reason: 'ea' });
  });

  it('is unavailable once a oncePerMonth action was already used this month', () => {
    const safe: ActionDef = { ...ACTION, limit: 'oncePerMonth' };
    const state: GameState = { ...createInitialState(1), actionsUsedThisMonth: [safe.id] };
    expect(checkAvailability(safe, state)).toEqual({ ok: false, reason: 'limit' });
    expect(checkAvailability(safe, createInitialState(1))).toEqual({ ok: true });
  });

  it('does not limit an action with no limit set, however often it was used', () => {
    const state: GameState = {
      ...createInitialState(1),
      actionsUsedThisMonth: [ACTION.id, ACTION.id],
    };
    expect(checkAvailability(ACTION, state)).toEqual({ ok: true });
  });

  it('is unavailable when a third activeCharacter argument names an official not in actors', () => {
    expect(checkAvailability(ACTION, createInitialState(1), 'vance')).toEqual({
      ok: false,
      reason: 'wrongOfficial',
    });
  });

  it('is available when activeCharacter matches actors, or actors is "any"', () => {
    expect(checkAvailability(ACTION, createInitialState(1), 'trump')).toEqual({ ok: true });
    const open: ActionDef = { ...ACTION, actors: 'any' };
    expect(checkAvailability(open, createInitialState(1), 'vance')).toEqual({ ok: true });
  });

  it('skips the officer gate entirely when activeCharacter is omitted', () => {
    expect(checkAvailability(ACTION, createInitialState(1))).toEqual({ ok: true });
  });
});
