import { describe, expect, it } from 'vitest';
import { ENEMY_SPAWN_POSITIONS, US_SPAWN_POSITIONS } from '@/data/battlefield';
import type { GridPosition } from '@/engine/movement';
import { occludes, occludingUnitIds, unitsOccludingActive } from './spriteOcclusion';

function unit(id: string, pos: GridPosition) {
  return { id, pos };
}

describe('occludes', () => {
  it('is true when a unit sits exactly one tile-height in front of another on the same screen column', () => {
    // (3,6) and (2,5): same screen x ((3-6)*16 = (2-5)*16 = -48), y 16px apart
    // ((3+6)*8=72 vs (2+5)*8=56) — the exact real spawn-formation geometry that
    // triggered the user's report. isoDepth(3,6)=9 > isoDepth(2,5)=7, so (3,6) is
    // the front unit here.
    expect(occludes({ x: 3, y: 6 }, { x: 2, y: 5 })).toBe(true);
  });

  it('is false for two units far apart on the field', () => {
    expect(occludes({ x: 10, y: 10 }, { x: 2, y: 2 })).toBe(false);
  });

  it('is false for adjacent-column neighbors whose sprite boxes don’t actually overlap', () => {
    // (3,4) and (2,5): screen x -16 vs -48 (32px apart, wider than the 26px sprite box
    // so there's a real gap), same screen y (56) — no vertical stacking at all.
    expect(occludes({ x: 3, y: 4 }, { x: 2, y: 5 })).toBe(false);
  });

  it('is false at the exact same position (degenerate, not expected in a real battle)', () => {
    // Full overlap in both axes, but with no draw-order winner this is undefined by the
    // caller's contract (occludingUnitIds never calls it this way) — documented here as
    // a sanity check that it doesn't throw, not as an endorsement of a particular answer.
    expect(() => occludes({ x: 5, y: 5 }, { x: 5, y: 5 })).not.toThrow();
  });
});

describe('occludingUnitIds', () => {
  it('flags the real US spawn formation’s two occluding pairs, and no one else', () => {
    // US_SPAWN_POSITIONS (data/battlefield.ts): (2,5)/(3,6) and (2,7)/(3,8) each stack on
    // the same screen column one tile-height apart — the exact bug from the user's
    // screenshot. (3,4) and (2,9) are lone column endpoints with no overlapping partner.
    const units = US_SPAWN_POSITIONS.map((pos, i) => unit(`us${i}`, pos));
    // US_SPAWN_POSITIONS order: 0:(2,5) 1:(2,7) 2:(2,9) 3:(3,4) 4:(3,6) 5:(3,8)
    const occluding = occludingUnitIds(units);
    expect(occluding).toEqual(new Set(['us4', 'us5'])); // (3,6) and (3,8), the front half of each pair
  });

  it('flags the real enemy spawn formation’s occluding pair the same way', () => {
    // ENEMY_SPAWN_POSITIONS: (17,7) and (16,6) share screen x=160, 16px apart in y —
    // same stacking pattern as the US side (see this file's module doc comment: this
    // isn't scoped to the player's own team).
    const units = ENEMY_SPAWN_POSITIONS.map((pos, i) => unit(`e${i}`, pos));
    const occluding = occludingUnitIds(units);
    const frontIndex = ENEMY_SPAWN_POSITIONS.findIndex((p) => p.x === 17 && p.y === 7);
    expect(occluding.has(`e${frontIndex}`)).toBe(true);
  });

  it('returns an empty set when nothing overlaps', () => {
    const units = [unit('a', { x: 0, y: 0 }), unit('b', { x: 10, y: 10 })];
    expect(occludingUnitIds(units)).toEqual(new Set());
  });

  it('lets a unit be both an occluder and occluded at once (a three-deep column)', () => {
    // Three units stacked one tile-height apart on the same screen column: 'front'
    // (x+y=8) occludes 'mid' (x+y=6, one tile-height back — the same geometry as the
    // canonical pair above), and 'mid' in turn occludes 'back' (x+y=4). 'front' and
    // 'back' are two tile-heights apart, which falls *under* MIN_OCCLUSION_FRACTION (see
    // the "far apart" case above's math), so 'back' itself never occludes anyone.
    const units = [
      unit('front', { x: 4, y: 4 }),
      unit('mid', { x: 3, y: 3 }),
      unit('back', { x: 2, y: 2 }),
    ];
    expect(occludingUnitIds(units)).toEqual(new Set(['front', 'mid']));
  });

  it('ignores a pair with equal isoDepth (no reliable draw-order winner)', () => {
    // (1,2) and (2,1) both have isoDepth 3, and sit at the same screen y (24) but
    // different screen x — not actually a real-world spawn scenario, just confirming
    // the depth-tie guard doesn't misfire.
    const units = [unit('a', { x: 1, y: 2 }), unit('b', { x: 2, y: 1 })];
    expect(occludingUnitIds(units)).toEqual(new Set());
  });
});

describe('unitsOccludingActive', () => {
  it('flags only the unit covering the active one, ignoring an unrelated occluding pair elsewhere', () => {
    // Real US spawn formation, all 6 units: (2,5)/(3,6) and (2,7)/(3,8) both occlude
    // (per the 'occludingUnitIds' test above), but only 'us2' (2,9) is active here, and
    // nothing occludes *it* — none of the other 5 spawns share its screen column. User
    // feedback this narrows: "The only [units] in front and around the USA current
    // playing player should be semi transparent" — the (3,6)/(3,8) pairs occluding their
    // own back-row teammates are real occlusion by `occludingUnitIds`'s definition, but
    // irrelevant to the currently active unit and must not show up here.
    const units = US_SPAWN_POSITIONS.map((pos, i) => unit(`us${i}`, pos));
    expect(unitsOccludingActive(units, 'us2')).toEqual(new Set());
  });

  it('flags a unit in front of the active one, and only that one', () => {
    // 'us1' (2,7) is the active unit here; 'us5' (3,8) sits one tile-height in front of
    // it on the same screen column (the same geometry as the canonical occluding pair),
    // so it should be flagged. 'us4' (3,6) occludes a *different* unit ('us0') entirely
    // unrelated to 'us1' and must not appear.
    const units = US_SPAWN_POSITIONS.map((pos, i) => unit(`us${i}`, pos));
    expect(unitsOccludingActive(units, 'us1')).toEqual(new Set(['us5']));
  });

  it('is empty when the active unit is itself the front of an occluding pair', () => {
    // 'us4' (3,6) occludes 'us0' (2,5) — it's the *front* half of the (2,5)/(3,6) pair —
    // but nothing else on the field is in front of 'us4' on its own screen column, so as
    // the active unit here it correctly gets an empty set: it's occluding a teammate,
    // not being occluded itself, and the active unit is never faded regardless (see
    // BattleView.tsx's isCurrent handling), so there'd be nothing to do with its own id
    // even if this returned it.
    const units = US_SPAWN_POSITIONS.map((pos, i) => unit(`us${i}`, pos));
    expect(unitsOccludingActive(units, 'us4')).toEqual(new Set());
  });

  it('returns an empty set when the active id isn’t found', () => {
    const units = [unit('a', { x: 0, y: 0 })];
    expect(unitsOccludingActive(units, 'missing')).toEqual(new Set());
  });
});
