import { useEffect } from 'react';
import { displayName, shortName } from '@/data/characters';
import { getCountry } from '@/data/countries';
import {
  currentUnit,
  reachableTiles,
  targetsInRange,
  type BattleState,
  type BattleUnit,
} from '@/engine/battle';
import type { GridPosition, TileKind } from '@/engine/movement';
import type { CharacterId } from '@/engine/types';
import { useGameStore } from '@/store/gameStore';
import { IsoBlock } from '../room/IsoBlocks';
import {
  CUBE_FACES_WALL,
  ISO_WALL_HEIGHT,
  isoDepth,
  isoGridBounds,
  projectIsoWithin,
  type IsoPoint,
} from '../room/isometric';
import { useT, type TFunction } from '../useT';

function posKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** The battlefield (`data/battlefield.ts`) is 11×8 tiles — projected at the room
 * camera's normal tile size (`ui/room/isometric.ts`'s `ISO_TILE_WIDTH/HEIGHT`, shared
 * with `RoomView`) it alone eats most of the 480px-wide stage, leaving the roster
 * sidebars too narrow for names (GAME_PLAN §7.1's layout bug). Rather than shrink the
 * shared tile constants (which would also shrink every room), the grid is rendered at
 * full size and then visually scaled down within a smaller box — battle-view-only,
 * doesn't touch `ui/room/`. Stacking each roster row's composure bar under its name
 * (`.battle-roster-info` in battle.css) freed up enough sidebar width to raise this
 * from the first pass's 0.7 to 0.85 — a bigger board, still with room for names. */
const BATTLE_GRID_SCALE = 0.85;

/** A unit's display name: the name layer for a US official, the roster's i18n key for
 * an enemy (GAME_PLAN §14 / CLAUDE.md's naming rule — never a hardcoded string here). */
function unitLabel(unit: BattleUnit, t: TFunction): string {
  if (unit.side === 'us') return displayName(unit.id as CharacterId);
  return unit.nameKey ? t(unit.nameKey) : unit.id;
}

/** The name shown in a roster sidebar row, where a full display name doesn't fit
 * (see battle.css's `.battle-roster-name` doc comment): the 8-character HUD-style
 * short name for a US official, same as `unitLabel` for an enemy since the enemy
 * rosters (`data/battleRosters.ts`) have no short-name layer of their own yet — those
 * rows wrap onto two lines instead. */
function rosterLabel(unit: BattleUnit, t: TFunction): string {
  if (unit.side === 'us') return shortName(unit.id as CharacterId);
  return unit.nameKey ? t(unit.nameKey) : unit.id;
}

function findUnit(battle: BattleState, id: string): BattleUnit | undefined {
  return battle.units.find((u) => u.id === id);
}

function UnitRow({ unit, isCurrent, t }: { unit: BattleUnit; isCurrent: boolean; t: TFunction }) {
  const pct = Math.round((unit.composure / unit.maxComposure) * 100);
  const classes = [
    'battle-roster-row',
    isCurrent ? 'is-current' : '',
    unit.composure <= 0 ? 'is-defeated' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li className={classes}>
      {unit.sprite ? (
        <img className="battle-roster-swatch" src={unit.sprite} alt="" aria-hidden="true" />
      ) : (
        <span
          className="battle-roster-swatch"
          style={{ background: unit.placeholder.color }}
          aria-hidden="true"
        >
          {unit.placeholder.initials}
        </span>
      )}
      <span className="battle-roster-info">
        <span className="battle-roster-name">{rosterLabel(unit, t)}</span>
        <span className="battle-composure-bar" aria-hidden="true">
          <span className="battle-composure-fill" style={{ width: `${pct}%` }} />
        </span>
      </span>
    </li>
  );
}

/** One battlefield cell: an inert extruded block for a wall, or a clickable diamond
 * (reusing the room camera's `.iso-diamond` look, GAME_PLAN §11) for floor — highlighted
 * when it's reachable this turn or holds an attackable target. */
function BattleTile({
  tile,
  pos,
  point,
  highlight,
  disabled,
  onClick,
}: {
  tile: TileKind;
  pos: GridPosition;
  point: IsoPoint;
  highlight: 'reachable' | 'attackable' | null;
  disabled: boolean;
  onClick: () => void;
}) {
  const depth = isoDepth(pos);
  const key = posKey(pos.x, pos.y);

  if (tile === 'wall') {
    return (
      <IsoBlock
        key={key}
        point={point}
        depth={depth}
        height={ISO_WALL_HEIGHT}
        faces={CUBE_FACES_WALL}
        className="iso-wall"
      />
    );
  }

  const classes = [
    'iso-diamond',
    'iso-floor',
    'battle-iso-tile',
    highlight === 'reachable' ? 'is-reachable' : '',
    highlight === 'attackable' ? 'is-attackable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      key={key}
      type="button"
      className={classes}
      style={{ left: point.x, top: point.y, zIndex: depth * 10 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={key}
    />
  );
}

/** A battle unit's isometric token: anchored to the bottom-center of its tile, same
 * "colored square with initials" placeholder as the room camera's player marker. */
function BattleUnitToken({
  unit,
  point,
  isCurrent,
}: {
  unit: BattleUnit;
  point: IsoPoint;
  isCurrent: boolean;
}) {
  const depth = isoDepth(unit.pos);
  const classes = ['battle-unit-iso', `is-${unit.side}`, isCurrent ? 'is-current' : '']
    .filter(Boolean)
    .join(' ');
  if (unit.sprite) {
    return (
      <img
        className={classes}
        src={unit.sprite}
        style={{ left: point.x, top: point.y, zIndex: depth * 10 + 5 }}
        alt=""
        aria-hidden="true"
      />
    );
  }
  return (
    <div
      className={classes}
      style={{
        left: point.x,
        top: point.y,
        zIndex: depth * 10 + 5,
        background: unit.placeholder.color,
      }}
      aria-hidden="true"
    >
      {unit.placeholder.initials}
    </div>
  );
}

/**
 * The tactical battle screen (GAME_PLAN §7.1): declaring war plays out here instead of
 * an instant roll. Rendered on the same isometric camera as the room view (`ui/room/`,
 * GAME_PLAN §11) rather than a flat grid, so the battle doesn't look like a different
 * game — it reuses `ui/room/isometric.ts`'s projection math and `IsoBlocks.tsx`'s tile
 * primitives, adding only what's battle-specific (clickable tiles, unit tokens).
 */
export function BattleView() {
  const t = useT();
  const resolution = useGameStore((s) => s.resolution);
  const battleMove = useGameStore((s) => s.battleMove);
  const battleAttack = useGameStore((s) => s.battleAttack);
  const battleEndTurn = useGameStore((s) => s.battleEndTurn);
  const battleRunEnemyTurn = useGameStore((s) => s.battleRunEnemyTurn);

  const battleForEffect = resolution?.phase === 'battle' ? resolution.battle : undefined;
  const activeForEffect = battleForEffect ? currentUnit(battleForEffect) : null;

  // Enemy turns play themselves out — there's no one to click for them — on a short
  // delay so the player can actually see what happened, one unit at a time.
  useEffect(() => {
    if (!battleForEffect || !activeForEffect || activeForEffect.side !== 'enemy') return;
    const timer = setTimeout(() => battleRunEnemyTurn(), 700);
    return () => clearTimeout(timer);
  }, [battleForEffect, activeForEffect, battleRunEnemyTurn]);

  if (
    !resolution ||
    resolution.phase !== 'battle' ||
    !resolution.battle ||
    !resolution.battleCountry
  ) {
    return null;
  }

  const battle = resolution.battle;
  const active = currentUnit(battle);
  const isPlayerTurn = active.side === 'us';
  const reachable = isPlayerTurn ? reachableTiles(battle, active.id) : [];
  const targets = isPlayerTurn ? targetsInRange(battle, active.id) : [];
  const reachableKeys = new Set(reachable.map((p) => posKey(p.x, p.y)));
  const targetKeys = new Set(targets.map((u) => posKey(u.pos.x, u.pos.y)));
  const targetIds = new Set(targets.map((u) => u.id));

  const bounds = isoGridBounds(battle.grid);
  const usUnits = battle.units.filter((u) => u.side === 'us');
  const enemyUnits = battle.units.filter((u) => u.side === 'enemy');
  const living = battle.units.filter((u) => u.composure > 0);
  const lastLog = battle.log[battle.log.length - 1];
  const lastAttacker = lastLog && findUnit(battle, lastLog.attackerId);
  const lastDefender = lastLog && findUnit(battle, lastLog.defenderId);

  const handleTileClick = (x: number, y: number) => {
    if (!isPlayerTurn) return;
    const key = posKey(x, y);
    const occupant = living.find((u) => u.pos.x === x && u.pos.y === y);
    if (occupant && targetIds.has(occupant.id)) {
      battleAttack(occupant.id);
      return;
    }
    if (reachableKeys.has(key)) battleMove({ x, y });
  };

  return (
    <div className="menu-overlay battle-overlay" role="dialog" aria-modal="true">
      <h2 className="menu-overlay-title">
        {t('battle.title', { country: t(getCountry(resolution.battleCountry).nameKey) })}
      </h2>
      <p className="battle-round">{t('battle.round', { n: battle.round })}</p>

      <div className="battle-body">
        <ul className="battle-roster">
          {usUnits.map((u) => (
            <UnitRow key={u.id} unit={u} isCurrent={active.id === u.id} t={t} />
          ))}
        </ul>

        <div
          className="battle-grid-scale"
          style={{ width: bounds.width * BATTLE_GRID_SCALE, height: bounds.height * BATTLE_GRID_SCALE }}
        >
          <div className="battle-grid-iso" style={{ width: bounds.width, height: bounds.height }}>
            {battle.grid.map((row, y) =>
              row.map((tile, x) => {
                const pos = { x, y };
                const key = posKey(x, y);
                const highlight = targetKeys.has(key)
                  ? 'attackable'
                  : reachableKeys.has(key)
                    ? 'reachable'
                    : null;
                return (
                  <BattleTile
                    key={key}
                    tile={tile}
                    pos={pos}
                    point={projectIsoWithin(pos, bounds)}
                    highlight={highlight}
                    disabled={!isPlayerTurn}
                    onClick={() => handleTileClick(x, y)}
                  />
                );
              }),
            )}
            {living.map((u) => (
              <BattleUnitToken
                key={u.id}
                unit={u}
                point={projectIsoWithin(u.pos, bounds)}
                isCurrent={active.id === u.id}
              />
            ))}
          </div>
        </div>

        <ul className="battle-roster">
          {enemyUnits.map((u) => (
            <UnitRow key={u.id} unit={u} isCurrent={active.id === u.id} t={t} />
          ))}
        </ul>
      </div>

      <p className="battle-turn-banner">
        {isPlayerTurn
          ? t('battle.turn.us', { name: unitLabel(active, t) })
          : t('battle.turn.enemy', { name: unitLabel(active, t) })}
      </p>

      {lastLog && lastAttacker && lastDefender && (
        <p className="battle-log-line">
          {t('battle.log.attack', {
            attacker: unitLabel(lastAttacker, t),
            defender: unitLabel(lastDefender, t),
            n: lastLog.amount,
          })}
          {lastLog.defeated
            ? ` ${t('battle.log.defeated', { name: unitLabel(lastDefender, t) })}`
            : ''}
        </p>
      )}

      {isPlayerTurn && (
        <div className="battle-actions">
          <button type="button" className="pixel-button" onClick={battleEndTurn}>
            {t('battle.action.endTurn')}
          </button>
        </div>
      )}
    </div>
  );
}
