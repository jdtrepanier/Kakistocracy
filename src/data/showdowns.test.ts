import { describe, expect, it } from 'vitest';
import { getAction } from './actions';
import { getShowdownForAction, SHOWDOWNS } from './showdowns';

describe('SHOWDOWNS', () => {
  it('has unique ids and three rounds of three choices each', () => {
    expect(new Set(SHOWDOWNS.map((s) => s.id)).size).toBe(SHOWDOWNS.length);
    for (const showdown of SHOWDOWNS) {
      expect(showdown.rounds).toHaveLength(3);
      for (const round of showdown.rounds) expect(round.choices).toHaveLength(3);
    }
  });

  it('only points at real, currently-built actions', () => {
    for (const showdown of SHOWDOWNS) {
      expect(() => getAction(showdown.actionId)).not.toThrow();
    }
  });

  it('covers all four showdown-gated actions (GAME_PLAN §17 Phase 3/5)', () => {
    expect(SHOWDOWNS.map((s) => s.actionId).sort()).toEqual([
      'buy_country',
      'lower_interest_rates',
      'pass_big_beautiful_bill',
      'press_conference',
    ]);
  });
});

describe('getShowdownForAction', () => {
  it('finds the showdown for a gated action', () => {
    expect(getShowdownForAction('lower_interest_rates')?.id).toBe('fed');
  });

  it('returns undefined for an action with no showdown', () => {
    expect(getShowdownForAction('rally')).toBeUndefined();
  });
});
