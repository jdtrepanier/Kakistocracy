import { describe, expect, it } from 'vitest';
import type { MessageKey } from '@/i18n/en';
import { isShowdownComplete, totalShowdownModifier, type ShowdownDef } from './showdown';

// Not real content keys: a throwaway fixture, not shown in any UI.
const KEY = 'action.test.name' as MessageKey;

function choice(modifier: number) {
  return { labelKey: KEY, modifier };
}

const SHOWDOWN: ShowdownDef = {
  id: 'test_showdown',
  actionId: 'test_action',
  rounds: [
    { promptKey: KEY, choices: [choice(10), choice(0), choice(-10)] },
    { promptKey: KEY, choices: [choice(15), choice(0), choice(-15)] },
    { promptKey: KEY, choices: [choice(5), choice(0), choice(-5)] },
  ],
};

describe('totalShowdownModifier', () => {
  it('is 0 with no choices made', () => {
    expect(totalShowdownModifier(SHOWDOWN, [])).toBe(0);
  });

  it('sums the modifier of each chosen response, one per round', () => {
    expect(totalShowdownModifier(SHOWDOWN, [0, 0])).toBe(25);
    expect(totalShowdownModifier(SHOWDOWN, [0, 0, 0])).toBe(30);
    expect(totalShowdownModifier(SHOWDOWN, [2, 2, 2])).toBe(-30);
    expect(totalShowdownModifier(SHOWDOWN, [1, 1, 1])).toBe(0);
  });

  it('ignores an out-of-range round or choice index instead of throwing', () => {
    expect(totalShowdownModifier(SHOWDOWN, [0, 99])).toBe(10);
    expect(totalShowdownModifier(SHOWDOWN, [0, 0, 0, 0])).toBe(30);
  });
});

describe('isShowdownComplete', () => {
  it('is false until every round has a choice', () => {
    expect(isShowdownComplete(SHOWDOWN, [])).toBe(false);
    expect(isShowdownComplete(SHOWDOWN, [0])).toBe(false);
    expect(isShowdownComplete(SHOWDOWN, [0, 0])).toBe(false);
  });

  it('is true once every round has a choice', () => {
    expect(isShowdownComplete(SHOWDOWN, [0, 0, 0])).toBe(true);
  });
});
