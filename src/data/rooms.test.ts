import { describe, expect, it } from 'vitest';
import { ACTIONS } from './actions';
import { roomLabelKey } from './rooms';

describe('roomLabelKey', () => {
  it('has a label for every room actually used by an action', () => {
    for (const action of ACTIONS) {
      expect(roomLabelKey(action.room)).toMatch(/^room\./);
    }
  });
});
