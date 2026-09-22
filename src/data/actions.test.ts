import { describe, expect, it } from 'vitest';
import { ACTIONS, getAction } from './actions';
import { CHARACTERS } from './characters';

describe('ACTIONS', () => {
  it('has 40 actions with unique ids', () => {
    expect(ACTIONS).toHaveLength(40);
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
        'declare_war_object',
        'buy_country',
        'fire_fed_chair',
        'fire_statistician',
        'mint_platinum_coin',
      ]),
    );
  });

  it('never IQ-gates Declare War on a country (real user feedback: it should always be available)', () => {
    expect(getAction('declare_war').requires?.iqMax).toBeUndefined();
  });

  it('limits the safe actions to once per month', () => {
    const safe = ACTIONS.filter((a) => a.limit === 'oncePerMonth');
    expect(safe.map((a) => a.id).sort()).toEqual([
      'be_best',
      'rally',
      'read_briefing',
      'senate_trial',
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

  it('gates the Senate trial behind Congress actually being lost', () => {
    const senateTrial = getAction('senate_trial');
    expect(senateTrial.requires?.flags).toEqual(['congressLost']);
    expect(senateTrial.room).toBe('capitol');
  });

  it('revoking press access is a Rose Garden decree that flags pressAccessRevoked on success only', () => {
    const revokePress = getAction('revoke_press_access');
    expect(revokePress.room).toBe('roseGarden');
    expect(revokePress.onSuccess).toContainEqual({ kind: 'flag', set: 'pressAccessRevoked' });
    expect(revokePress.onFail).not.toContainEqual({ kind: 'flag', set: 'pressAccessRevoked' });
  });

  it('limits launching Trump TV to once per run and flags trumpTvLaunched on success only', () => {
    const trumpTv = getAction('start_trump_tv');
    expect(trumpTv.limit).toBe('oncePerRun');
    expect(trumpTv.room).toBe('marALago');
    expect(trumpTv.onSuccess).toContainEqual({ kind: 'flag', set: 'trumpTvLaunched' });
    expect(trumpTv.onFail).not.toContainEqual({ kind: 'flag', set: 'trumpTvLaunched' });
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
