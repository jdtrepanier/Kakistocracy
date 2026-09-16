import { describe, expect, it } from 'vitest';
import {
  actionHasBattle,
  attack,
  checkOutcome,
  createBattle,
  currentUnit,
  enemyTakeTurn,
  endTurn,
  moveUnit,
  reachableTiles,
  targetsInRange,
  unitById,
  type BattleUnitTemplate,
} from './battle';
import type { GridPosition, RoomGrid } from './movement';

// A 5x5 bordered field: floor everywhere inside the walls, i.e. x/y in [1, 3].
const GRID: RoomGrid = [
  ['wall', 'wall', 'wall', 'wall', 'wall'],
  ['wall', 'floor', 'floor', 'floor', 'wall'],
  ['wall', 'floor', 'floor', 'floor', 'wall'],
  ['wall', 'floor', 'floor', 'floor', 'wall'],
  ['wall', 'wall', 'wall', 'wall', 'wall'],
];

function template(id: string, overrides: Partial<BattleUnitTemplate> = {}): BattleUnitTemplate {
  return {
    id,
    move: 2,
    range: 1,
    power: 3,
    maxComposure: 10,
    placeholder: { initials: 'X', color: '#000' },
    ...overrides,
  };
}

function manhattan(a: GridPosition, b: GridPosition): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

describe('createBattle', () => {
  it('places both rosters and interleaves the turn order', () => {
    const battle = createBattle(
      GRID,
      [
        { template: template('us1'), pos: { x: 1, y: 1 } },
        { template: template('us2'), pos: { x: 1, y: 2 } },
      ],
      [{ template: template('e1'), pos: { x: 3, y: 1 } }],
      42,
    );
    expect(battle.units).toHaveLength(3);
    expect(battle.turnOrder).toEqual(['us1', 'e1', 'us2']);
    expect(battle.round).toBe(1);
    expect(currentUnit(battle).id).toBe('us1');
    expect(unitById(battle, 'us1').composure).toBe(10);
  });
});

describe('reachableTiles', () => {
  it('reaches tiles within move distance through open floor, excluding its own tile', () => {
    const battle = createBattle(
      GRID,
      [{ template: template('us1', { move: 2 }), pos: { x: 1, y: 1 } }],
      [],
      1,
    );
    const tiles = reachableTiles(battle, 'us1');
    expect(tiles).not.toContainEqual({ x: 1, y: 1 });
    expect(tiles).toContainEqual({ x: 2, y: 1 });
    expect(tiles).toContainEqual({ x: 3, y: 1 });
    expect(tiles).not.toContainEqual({ x: 0, y: 1 }); // a wall
  });

  it('does not pass through a tile occupied by another living unit', () => {
    const battle = createBattle(
      GRID,
      [{ template: template('us1', { move: 3 }), pos: { x: 1, y: 1 } }],
      [{ template: template('e1'), pos: { x: 2, y: 1 } }],
      1,
    );
    const tiles = reachableTiles(battle, 'us1');
    expect(tiles).not.toContainEqual({ x: 2, y: 1 });
  });
});

describe('moveUnit', () => {
  it('moves to a reachable tile', () => {
    const battle = createBattle(
      GRID,
      [{ template: template('us1', { move: 2 }), pos: { x: 1, y: 1 } }],
      [],
      1,
    );
    const next = moveUnit(battle, 'us1', { x: 2, y: 1 });
    expect(unitById(next, 'us1').pos).toEqual({ x: 2, y: 1 });
  });

  it('is a no-op if the tile is not reachable this turn', () => {
    const battle = createBattle(
      GRID,
      [{ template: template('us1', { move: 1 }), pos: { x: 1, y: 1 } }],
      [],
      1,
    );
    const next = moveUnit(battle, 'us1', { x: 3, y: 3 });
    expect(unitById(next, 'us1').pos).toEqual({ x: 1, y: 1 });
  });

  it('cannot be called twice in the same turn to stack extra movement', () => {
    const battle = createBattle(
      GRID,
      [{ template: template('us1', { move: 1 }), pos: { x: 1, y: 1 } }],
      [],
      1,
    );
    const once = moveUnit(battle, 'us1', { x: 2, y: 1 });
    expect(unitById(once, 'us1').pos).toEqual({ x: 2, y: 1 });

    const twice = moveUnit(once, 'us1', { x: 2, y: 2 });
    expect(unitById(twice, 'us1').pos).toEqual({ x: 2, y: 1 }); // unchanged

    const afterNewTurn = endTurn(endTurn(once)); // back around to us1's next turn
    const movedAgain = moveUnit(afterNewTurn, 'us1', { x: 2, y: 2 });
    expect(unitById(movedAgain, 'us1').pos).toEqual({ x: 2, y: 2 }); // allowed again
  });
});

describe('targetsInRange', () => {
  it('finds living opponents within range and none further away', () => {
    const battle = createBattle(
      GRID,
      [{ template: template('us1', { range: 1 }), pos: { x: 1, y: 1 } }],
      [
        { template: template('e1'), pos: { x: 2, y: 1 } },
        { template: template('e2'), pos: { x: 3, y: 3 } },
      ],
      1,
    );
    expect(targetsInRange(battle, 'us1').map((t) => t.id)).toEqual(['e1']);
  });

  it('excludes a defeated unit', () => {
    let battle = createBattle(
      GRID,
      [{ template: template('us1', { power: 99 }), pos: { x: 1, y: 1 } }],
      [{ template: template('e1', { maxComposure: 1 }), pos: { x: 2, y: 1 } }],
      1,
    );
    battle = attack(battle, 'us1', 'e1').state;
    expect(targetsInRange(battle, 'us1')).toEqual([]);
  });
});

describe('attack', () => {
  it('reduces the defender composure and logs the hit', () => {
    const battle = createBattle(
      GRID,
      [{ template: template('us1', { power: 3 }), pos: { x: 1, y: 1 } }],
      [{ template: template('e1', { maxComposure: 10 }), pos: { x: 2, y: 1 } }],
      7,
    );
    const { state, entry } = attack(battle, 'us1', 'e1');
    expect(entry.attackerId).toBe('us1');
    expect(entry.defenderId).toBe('e1');
    expect(entry.amount).toBeGreaterThanOrEqual(1);
    expect(unitById(state, 'e1').composure).toBe(10 - entry.amount);
    expect(state.log).toEqual([entry]);
  });

  it('never deals less than 1 damage and clamps composure at 0', () => {
    const battle = createBattle(
      GRID,
      [{ template: template('us1', { power: 1 }), pos: { x: 1, y: 1 } }],
      [{ template: template('e1', { maxComposure: 1 }), pos: { x: 2, y: 1 } }],
      7,
    );
    const { entry, state } = attack(battle, 'us1', 'e1');
    expect(unitById(state, 'e1').composure).toBe(0);
    expect(entry.defeated).toBe(true);
  });

  it('advances the rng state', () => {
    const battle = createBattle(
      GRID,
      [{ template: template('us1'), pos: { x: 1, y: 1 } }],
      [{ template: template('e1', { maxComposure: 999 }), pos: { x: 2, y: 1 } }],
      7,
    );
    const { state } = attack(battle, 'us1', 'e1');
    expect(state.rngState).not.toBe(battle.rngState);
  });
});

describe('endTurn', () => {
  it('advances to the next living unit and increments round on wraparound', () => {
    const battle = createBattle(
      GRID,
      [{ template: template('us1'), pos: { x: 1, y: 1 } }],
      [{ template: template('e1'), pos: { x: 2, y: 1 } }],
      1,
    );
    const afterFirst = endTurn(battle);
    expect(currentUnit(afterFirst).id).toBe('e1');
    expect(afterFirst.round).toBe(1);

    const afterSecond = endTurn(afterFirst);
    expect(currentUnit(afterSecond).id).toBe('us1');
    expect(afterSecond.round).toBe(2);
  });

  it('skips a defeated unit in the order', () => {
    let battle = createBattle(
      GRID,
      [{ template: template('us1', { power: 99 }), pos: { x: 1, y: 1 } }],
      [
        { template: template('e1', { maxComposure: 1 }), pos: { x: 2, y: 1 } },
        { template: template('e2'), pos: { x: 3, y: 3 } },
      ],
      1,
    );
    battle = attack(battle, 'us1', 'e1').state; // turnOrder: [us1, e1, e2] — e1 now dead
    expect(currentUnit(endTurn(battle)).id).toBe('e2');
  });
});

describe('checkOutcome', () => {
  it('is ongoing while both sides have living units', () => {
    const battle = createBattle(
      GRID,
      [{ template: template('us1'), pos: { x: 1, y: 1 } }],
      [{ template: template('e1'), pos: { x: 2, y: 1 } }],
      1,
    );
    expect(checkOutcome(battle)).toBe('ongoing');
  });

  it('is usWin once every enemy unit is defeated', () => {
    let battle = createBattle(
      GRID,
      [{ template: template('us1', { power: 99 }), pos: { x: 1, y: 1 } }],
      [{ template: template('e1', { maxComposure: 1 }), pos: { x: 2, y: 1 } }],
      1,
    );
    battle = attack(battle, 'us1', 'e1').state;
    expect(checkOutcome(battle)).toBe('usWin');
  });

  it('is enemyWin once every US unit is defeated', () => {
    let battle = createBattle(
      GRID,
      [{ template: template('us1', { maxComposure: 1 }), pos: { x: 1, y: 1 } }],
      [{ template: template('e1', { power: 99 }), pos: { x: 2, y: 1 } }],
      1,
    );
    battle = attack(battle, 'e1', 'us1').state;
    expect(checkOutcome(battle)).toBe('enemyWin');
  });
});

describe('enemyTakeTurn', () => {
  it('attacks immediately when already in range, without moving', () => {
    const battle = createBattle(
      GRID,
      [{ template: template('us1'), pos: { x: 1, y: 1 } }],
      [{ template: template('e1', { range: 1 }), pos: { x: 2, y: 1 } }],
      3,
    );
    const next = enemyTakeTurn(battle, 'e1');
    expect(next.log).toHaveLength(1);
    expect(next.log[0]?.defenderId).toBe('us1');
    expect(unitById(next, 'e1').pos).toEqual({ x: 2, y: 1 });
  });

  it('closes the distance toward the nearest US unit when out of range', () => {
    const battle = createBattle(
      GRID,
      [{ template: template('us1'), pos: { x: 1, y: 1 } }],
      [{ template: template('e1', { move: 2, range: 1 }), pos: { x: 3, y: 3 } }],
      3,
    );
    const next = enemyTakeTurn(battle, 'e1');
    const before = manhattan({ x: 3, y: 3 }, { x: 1, y: 1 });
    const after = manhattan(unitById(next, 'e1').pos, { x: 1, y: 1 });
    expect(after).toBeLessThan(before);
  });

  it('is a no-op for an already-defeated unit', () => {
    let battle = createBattle(
      GRID,
      [{ template: template('us1', { power: 99 }), pos: { x: 1, y: 1 } }],
      [{ template: template('e1', { maxComposure: 1 }), pos: { x: 2, y: 1 } }],
      3,
    );
    battle = attack(battle, 'us1', 'e1').state;
    expect(enemyTakeTurn(battle, 'e1')).toBe(battle);
  });
});

describe('actionHasBattle', () => {
  it('is true only for declare_war', () => {
    expect(actionHasBattle('declare_war')).toBe(true);
    expect(actionHasBattle('impose_tariff')).toBe(false);
  });
});
