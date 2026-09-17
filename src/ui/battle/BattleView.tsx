import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from 'react';
import { displayName } from '@/data/characters';
import { US_BADGE, US_COLOR, getCountry } from '@/data/countries';
import {
  currentUnit,
  reachableTiles,
  targetsInRange,
  type BattleLogEntry,
  type BattleState,
  type BattleUnit,
} from '@/engine/battle';
import type { GridPosition, TileKind } from '@/engine/movement';
import type { CharacterId } from '@/engine/types';
import { useGameStore } from '@/store/gameStore';
import { playBattleMusic, stopBattleMusic } from '../audio/sfx';
import { IsoBlock } from '../room/IsoBlocks';
import {
  CUBE_FACES_WALL,
  ISO_WALL_HEIGHT,
  isoDepth,
  isoGridBounds,
  projectIsoWithin,
  type IsoPoint,
} from '../room/isometric';
import { useElementSize } from '../room/useElementSize';
import { useStageScale } from '../useStageScale';
import { useT, type TFunction } from '../useT';
import { useBattleCamera } from './useBattleCamera';

/** Fixed arrow-key pan step, in stage px — one tile's height (`ISO_TILE_HEIGHT`), a
 * comfortable single-press increment at this pixel-art scale. */
const PAN_STEP = 16;

/** How long the camera glides to a new auto-follow/keyboard-pan position — must match
 * `styles/battle.css`'s `.battle-grid-iso` `transition: transform` duration by hand
 * (same "CSS can't reference a JS constant" reasoning `ROOM_MOVE_TRANSITION_MS` already
 * has, `ui/room/isometric.ts`). Overridden to `0ms` inline while actively dragging, so a
 * hand-pan tracks the pointer instead of easing behind it. */
const CAMERA_TRANSITION_MS = 160;
const KEY_PAN: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [0, -PAN_STEP],
  ArrowDown: [0, PAN_STEP],
  ArrowLeft: [-PAN_STEP, 0],
  ArrowRight: [PAN_STEP, 0],
};

/** Below this many client px of total pointer movement, a drag is treated as a plain
 * click/tap on whatever tile is under it rather than a pan — matches the small
 * "did they mean to drag" tolerance most browsers already give native scrollable
 * regions, so a slightly shaky tap still reaches the tile button underneath it. */
const DRAG_CLICK_TOLERANCE = 5;

function posKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** A unit's display name: the name layer for a US official, the roster's i18n key for
 * an enemy (GAME_PLAN §14 / CLAUDE.md's naming rule — never a hardcoded string here). */
function unitLabel(unit: BattleUnit, t: TFunction): string {
  if (unit.side === 'us') return displayName(unit.id as CharacterId);
  return unit.nameKey ? t(unit.nameKey) : unit.id;
}

function findUnit(battle: BattleState, id: string): BattleUnit | undefined {
  return battle.units.find((u) => u.id === id);
}

/**
 * One roster row: an HP bar (with the actual number next to it — user feedback asked to
 * be able to see HP, not just infer it from a bar's width) plus, for the two units with
 * a `magic` pool (Carney, Melania), a row of MP pips below it — filled left to right as
 * `magicCharge` builds toward `magic.max`, per `engine/battle.ts`'s doc comment.
 */
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
      <span className="battle-roster-name">{unitLabel(unit, t)}</span>
      <span className="battle-stat-col">
        <span
          className="battle-stat-row"
          title={t('battle.unit.hpLabel', { n: unit.composure, max: unit.maxComposure })}
        >
          <span className="battle-composure-bar" aria-hidden="true">
            <span className="battle-composure-fill" style={{ width: `${pct}%` }} />
          </span>
          <span className="battle-stat-value">{unit.composure}</span>
        </span>
        {unit.magic && (
          <span
            className="battle-stat-row"
            title={t('battle.unit.mpLabel', { n: unit.magicCharge, max: unit.magic.max })}
          >
            <span className="battle-magic-pips" aria-hidden="true">
              {Array.from({ length: unit.magic.max }, (_, i) => (
                <span
                  key={i}
                  className={i < unit.magicCharge ? 'battle-magic-pip is-filled' : 'battle-magic-pip'}
                />
              ))}
            </span>
          </span>
        )}
      </span>
    </li>
  );
}

/** Renders a log entry's full message, picking the right phrasing for its `kind`
 * (`BattleLogEntry`'s union — plain hit, heal, flee, dodge, charm, curse) — see
 * `engine/battle.ts`'s doc comment for what each quirk/spell actually does. Returns ''
 * if either unit involved can't be found (should never happen — every id in a log entry
 * names a unit that was on the field). */
function battleLogText(entry: BattleLogEntry, battle: BattleState, t: TFunction): string {
  const attacker = findUnit(battle, entry.attackerId);
  const defender = findUnit(battle, entry.defenderId);
  if (!attacker || !defender) return '';
  const attackerName = unitLabel(attacker, t);
  const defenderName = unitLabel(defender, t);

  switch (entry.kind) {
    case 'attack': {
      const base = entry.healed
        ? t('battle.log.heal', { attacker: attackerName, defender: defenderName, n: entry.amount })
        : t('battle.log.attack', {
            attacker: attackerName,
            defender: defenderName,
            n: entry.amount,
          });
      const suffix = entry.defeated ? ` ${t('battle.log.defeated', { name: defenderName })}` : '';
      return `${base}${suffix}`;
    }
    case 'flee':
      return t('battle.log.flee', { attacker: attackerName });
    case 'dodge':
      return t('battle.log.dodge', { defender: defenderName });
    case 'curse':
      return t('battle.log.curse', { attacker: attackerName, defender: defenderName });
    case 'charm': {
      const base = t('battle.log.charm', { attacker: attackerName, defender: defenderName });
      if (!entry.allyId || entry.allyAmount === undefined) {
        return `${base} ${t('battle.log.charmNoTarget')}`;
      }
      const ally = findUnit(battle, entry.allyId);
      const allyName = ally ? unitLabel(ally, t) : entry.allyId;
      const hit = t('battle.log.charmHit', {
        defender: defenderName,
        ally: allyName,
        n: entry.allyAmount,
      });
      const suffix = entry.allyDefeated ? ` ${t('battle.log.defeated', { name: allyName })}` : '';
      return `${base} ${hit}${suffix}`;
    }
    default:
      return '';
  }
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
 * "colored square with initials" placeholder as the room camera's player marker — plus
 * a small badge pastille under its feet (which side/country the unit belongs to,
 * user feedback: "the pastille should be under the character like if it was sitting on
 * it... give it an oval [shape] and a color", later upgraded to real per-country flag
 * art the user supplied — `data/countries.ts`'s `badge`/`US_BADGE`, cropped from
 * `public/assets/sprites/source/country-flags-sheet.png`) and a bobbing marker over its
 * head when it's that unit's turn. Both replace the old box-shadow rectangle drawn
 * around the whole sprite (real user feedback: it read as a loud, distracting outline
 * once real sprite art replaced the placeholder squares it was originally designed
 * around) with something that reads the same information — side, country, and whose
 * turn it is — without covering the character art. The badge renders *after* the
 * sprite here, at its natural "last in the column, at the feet" position, and needs an
 * explicit lower `z-index` than the sprite (`battle.css`) to actually paint underneath
 * it — flex items with `z-index: auto` (the default) stack in their *layout* order
 * regardless of DOM order, so "badge earlier in the markup" alone does not make it
 * paint first; a follow-up round of user feedback ("the pastille should be drawn
 * before the character, z-index lower") caught that this hadn't actually worked.
 * `.battle-unit-flag`'s negative `margin-top` in `battle.css` pulls the badge up to
 * overlap the sprite's bottom edge, so the character paints on top of it like a
 * shadow/base it's standing on, rather than the two just sitting stacked with a gap.
 * Falls back to a flat colored oval (`color`) when a country has no `badge` art yet —
 * same "real art if we have it, else a colored placeholder" pattern as the sprite
 * check just above it. */
function BattleUnitToken({
  unit,
  point,
  isCurrent,
  badge,
  color,
}: {
  unit: BattleUnit;
  point: IsoPoint;
  isCurrent: boolean;
  badge?: string;
  color: string;
}) {
  const depth = isoDepth(unit.pos);

  return (
    <div
      className="battle-unit-iso"
      style={{ left: point.x, top: point.y, zIndex: depth * 10 + 5 }}
    >
      {isCurrent && (
        <span className="battle-unit-current-marker" aria-hidden="true">
          ▼
        </span>
      )}
      {unit.sprite ? (
        <img className="battle-unit-sprite" src={unit.sprite} alt="" aria-hidden="true" />
      ) : (
        <div
          className="battle-unit-sprite battle-unit-placeholder"
          style={{ background: unit.placeholder.color }}
          aria-hidden="true"
        >
          {unit.placeholder.initials}
        </div>
      )}
      {badge ? (
        <img
          className={`battle-unit-flag battle-unit-flag-badge is-${unit.side}`}
          src={badge}
          alt=""
          aria-hidden="true"
        />
      ) : (
        <span
          className={`battle-unit-flag is-${unit.side}`}
          style={{ background: color }}
          aria-hidden="true"
        />
      )}
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

  // BattleView only ever mounts while a battle is actually on screen (ResolutionOverlay
  // renders it only for the 'battle' phase) and unmounts the moment it isn't, so a plain
  // mount/unmount effect plays the track for exactly the battle's duration — win, lose,
  // or the player backing out mid-fight all unmount this the same way.
  useEffect(() => {
    playBattleMusic();
    return () => stopBattleMusic();
  }, []);

  // The scrolling battle camera (user feedback: "make the battle much bigger and we
  // could scroll the map like in Shining Force" — `useBattleCamera.ts`/`battleCamera.ts`).
  // Every hook below has to run unconditionally, same reason as the two effects above,
  // so the "ForEffect" values fall back to something inert while there's no battle on
  // screen yet — `useElementSize` alone doesn't depend on the battle at all.
  const boundsForEffect = battleForEffect
    ? isoGridBounds(battleForEffect.grid)
    : { width: 0, height: 0, offsetX: 0, offsetY: 0 };
  const followPointForEffect = activeForEffect
    ? projectIsoWithin(activeForEffect.pos, boundsForEffect)
    : { x: 0, y: 0 };
  // Keyed on the active unit's position too, not just its id, so moving the active unit
  // during its own turn re-centers the camera on it again, not just a turn change.
  const followKeyForEffect = activeForEffect
    ? `${activeForEffect.id}:${activeForEffect.pos.x},${activeForEffect.pos.y}`
    : 'none';
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewportSize = useElementSize(viewportRef);
  const { camera, pan } = useBattleCamera(
    boundsForEffect,
    viewportSize,
    followPointForEffect,
    followKeyForEffect,
  );
  const scale = useStageScale();
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    viewportRef.current?.focus();
  }, []);

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

  const bounds = boundsForEffect;
  const usUnits = battle.units.filter((u) => u.side === 'us');
  const enemyUnits = battle.units.filter((u) => u.side === 'enemy');
  const living = battle.units.filter((u) => u.composure > 0);
  const lastLog = battle.log[battle.log.length - 1];
  const enemyCountry = getCountry(resolution.battleCountry);
  const unitColor = (unit: BattleUnit) => (unit.side === 'us' ? US_COLOR : enemyCountry.color);
  const unitBadge = (unit: BattleUnit) => (unit.side === 'us' ? US_BADGE : enemyCountry.badge);

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

  const handleViewportKeyDown = (event: KeyboardEvent) => {
    const delta = KEY_PAN[event.key];
    if (!delta) return;
    event.preventDefault();
    pan(delta[0], delta[1]);
  };

  // Drag-to-pan: tracked in a ref (not state) since every pointermove would otherwise
  // trigger a render just to read a coordinate back out. Deliberately does *nothing* —
  // no pan, no pointer capture, no click suppression — until the pointer has actually
  // moved past `DRAG_CLICK_TOLERANCE`: real user feedback reported tile selection
  // breaking entirely after an earlier version of this that captured the pointer and
  // started panning from the very first pixel of every pointerdown, including a plain
  // click with no real movement. Deferring all of that until a real drag is confirmed
  // means a plain click on a tile is untouched by any of this — it never sees a pan
  // call, a capture, or a suppressed click — while a genuine drag still captures the
  // pointer (so fast movement past the viewport's edge keeps updating) and suppresses
  // the click that would otherwise fire on whatever tile ends up under the pointer at
  // release (`suppressClickRef`, checked by `handleViewportClickCapture` below).
  const handleViewportPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = { x: event.clientX, y: event.clientY, dragging: false };
  };

  const handleViewportPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;

    if (!drag.dragging) {
      if (Math.hypot(dx, dy) <= DRAG_CLICK_TOLERANCE) return;
      drag.dragging = true;
      suppressClickRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
    }

    dragRef.current = { x: event.clientX, y: event.clientY, dragging: true };
    // Grab-the-map dragging, not scrollbar-style dragging: the point of the map under
    // the cursor at pointerdown should stay under the cursor as it moves, so the camera
    // offset moves WITH the pointer (same sign as dx/dy) — real user feedback flagged
    // an earlier version of this that panned the opposite way as "not following the
    // mouse." Divided by scale to convert real screen px to stage-internal px, since
    // the whole game is zoomed by an integer `useStageScale` factor — without it, a
    // drag would move the map faster than the cursor at any zoom above 1×.
    pan(dx / (scale || 1), dy / (scale || 1));
  };

  const endDrag = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  const handleViewportClickCapture = (event: MouseEvent) => {
    if (!suppressClickRef.current) return;
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  return (
    <div className="menu-overlay battle-overlay" role="dialog" aria-modal="true">
      <h2 className="menu-overlay-title">
        {t('battle.title', { country: t(getCountry(resolution.battleCountry).nameKey) })}
      </h2>
      <p className="battle-round">{t('battle.round', { n: battle.round })}</p>

      <div className="battle-body">
        <div
          ref={viewportRef}
          className="battle-viewport"
          role="application"
          tabIndex={0}
          aria-label={t('battle.viewport.label')}
          onKeyDown={handleViewportKeyDown}
          onPointerDown={handleViewportPointerDown}
          onPointerMove={handleViewportPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onClickCapture={handleViewportClickCapture}
        >
          <div
            className="battle-grid-iso"
            style={{
              width: bounds.width,
              height: bounds.height,
              transform: `translate(${camera.x}px, ${camera.y}px)`,
              transitionDuration: isDragging ? '0ms' : `${CAMERA_TRANSITION_MS}ms`,
            }}
          >
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
                badge={unitBadge(u)}
                color={unitColor(u)}
              />
            ))}
          </div>
        </div>

        <ul className="battle-roster battle-roster-compact battle-roster-us">
          {usUnits.map((u) => (
            <UnitRow key={u.id} unit={u} isCurrent={active.id === u.id} t={t} />
          ))}
        </ul>

        <ul className="battle-roster battle-roster-compact battle-roster-enemy">
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

      {lastLog && <p className="battle-log-line">{battleLogText(lastLog, battle, t)}</p>}

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
