import { describe, expect, it } from 'vitest';
import { ACTIONS, getAction } from './actions';
import { CHARACTERS } from './characters';

describe('ACTIONS', () => {
  it('has 37 actions with unique ids', () => {
    expect(ACTIONS).toHaveLength(37);
    expect(new Set(ACTIONS.map((a) => a.id)).size).toBe(ACTIONS.length);
  });

  it('gives every official at least one action they can actually trigger', () => {
    for (const character of CHARACTERS) {
      const usable = ACTIONS.some((a) => a.actors === 'any' || a.actors.includes(character.id));
      expect(usable).toBe(true);
    }
  });

  it('keeps every cost and success chance within sane bounds', () => {
    for (const action of ACTIONS) {
      expect(action.cost.ea).toBeGreaterThanOrEqual(0);
      expect(action.cost.ea).toBeLessThanOrEqual(3);
      expect(action.baseSuccess).toBeGreaterThanOrEqual(0);
      expect(action.baseSuccess).toBeLessThanOrEqual(100);
      expect(action.headlines).toBeGreaterThanOrEqual(0);
      if (action.actors !== 'any') expect(action.actors.length).toBeGreaterThan(0);
    }
  });

  it('gates the most spectacular actions behind low Party IQ', () => {
    const gated = ACTIONS.filter((a) => a.requires?.iqMax !== undefined);
    expect(gated.map((a) => a.id)).toEqual(
      expect.arrayContaining([
        'declare_war',
        'declare_war_object',
        'buy_country',
        'fire_fed_chair',
        'fire_statistician',
        'mint_platinum_coin',
      ]),
    );
  });

  it('limits the safe actions to once per month', () => {
    const safe = ACTIONS.filter((a) => a.limit === 'oncePerMonth');
    expect(safe.map((a) => a.id).sort()).toEqual([
      'be_best',
      'rally',
      'read_briefing',
      'summit',
      'truth_post_3am',
    ]);
  });

  it('gates the reactor-inspection event behind an actual DOGE energy cut', () => {
    const dogeChainsaw = getAction('doge_chainsaw');
    expect(dogeChainsaw.onSuccess).toContainEqual({
      kind: 'chance',
      p: 0.3,
      then: [{ kind: 'flag', set: 'dogeCutEnergy' }],
      else: [],
    });
  });

  it('wires Declare War and Buy a Country to the World Map menu', () => {
    const declareWar = getAction('declare_war');
    expect(declareWar.onSuccess).toContainEqual({ kind: 'declareWar' });
    expect(declareWar.onFail).not.toContainEqual({ kind: 'declareWar' });

    const buyCountry = getAction('buy_country');
    expect(buyCountry.onSuccess).toContainEqual({ kind: 'purchaseCountry' });
    expect(buyCountry.onFail).not.toContainEqual({ kind: 'purchaseCountry' });
  });
});

describe('getAction', () => {
  it('finds an action by id', () => {
    expect(getAction('rally').id).toBe('rally');
  });

  it('throws for an unknown id', () => {
    expect(() => getAction('nope')).toThrow();
  });
});
