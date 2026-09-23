import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type WheelEvent,
} from 'react';
import {
  BLOCK_TERRAIN,
  getBattleground,
  type BattlegroundProp,
  type TerrainKind,
} from '@/data/battlegrounds';
import { displayName } from '@/data/characters';
import { US_BADGE, US_COLOR, getCountry } from '@/data/countries';
import {
  currentUnit,
  reachableTiles,
  spriteForFacing,
  targetsInRange,
  type BattleLogEntry,
  type BattleState,
  type BattleUnit,
} from '@/engine/battle';
import type { GridPosition, TileKind } from '@/engine/movement';
import type { CharacterId, CountryId } from '@/engine/types';
import { useGameStore } from '@/store/gameStore';
import { playBattleMusic, playSfx, stopBattleMusic, type SfxId } from '../audio/sfx';
import { IsoBlock } from '../room/IsoBlocks';
import {
  CUBE_FACES_WALL,
  ISO_WALL_HEIGHT,
  isoDepth,
  isoGridBounds,
  projectIsoWithin,
  type IsoBounds,
  type IsoPoint,
} from '../room/isometric';
import { useElementSize } from '../room/useElementSize';
import { useStageScale } from '../useStageScale';
import { useT, type TFunction } from '../useT';
import { unitsOccludingActive } from './spriteOcclusion';
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

/** Battle-only zoom (user request, after a screenshot comparison: "would it be feasible
 * to zoom in/zoom out in battle mode so I can show you how different it is" — separate
 * from the whole-game `useStageScale` fit-to-window zoom, which stays fixed here). 0.5×
 * lets the full ~544×294 stage-px grid (a 20×14 field, `isoGridBounds`) shrink small
 * enough to mostly fit the battle viewport at once — the whole reason for this feature —
 * without going so small the pixel art turns to mush; 2× is a close-up on a couple of
 * units, well before individual tiles get too big to read as a battlefield. Applied as a
 * CSS `scale()` on `.battle-grid-iso`, composed *after* the existing `translate(camera)`
 * in the same `transform` — per the CSS transform-list spec that composes right-to-left,
 * so `scale` acts on the grid's own local content first and `translate` moves the
 * already-scaled result in the viewport's own (zoom-independent) pixel space. That's
 * exactly why `camera.x`/`camera.y` themselves are always plain viewport-local px,
 * regardless of zoom — only the *inputs* to `centerOn`/`clampCamera` need scaling by
 * `zoom` first (see `zoomedBoundsForEffect`/`zoomedFollowPointForEffect` below), and why
 * `zoomAt`'s own math (below `handleTileClick`) can treat `camera.x/y` and a raw cursor
 * position as the same coordinate space.
 *
 * **Zooms around a point, not always the active unit** (real user feedback: "the zoom
 * should be on the mouse cursor position, not on the current player" — this used to
 * re-center on the active unit on every zoom change, via `zoom` being part of
 * `followKeyForEffect`; it no longer is, see that variable's own comment). `zoomAt`
 * below is the shared implementation: the wheel handler anchors on the real cursor
 * position, and the +/- buttons and keyboard shortcuts (which have no meaningful cursor
 * position over the map) anchor on the viewport's own center instead. */
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;

/** `.battle-roster-compact`'s width in `battle.css` — kept in sync by hand, same
 * precedent as `mapeditor/editor.js`'s `CELL_SIZE_DEFAULT` mirroring the real game's
 * `ISO_TILE_WIDTH`. Passed to `useBattleCamera` as its `horizontalPadding` — see
 * `clampCamera`'s own doc comment (`battleCamera.ts`) for why the roster panels need
 * extra pan range, not just a plain edge clamp. */
const ROSTER_PANEL_WIDTH = 92;

function clampZoom(z: number): number {
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
}

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
 * Sound cue for a freshly-appended `BattleLogEntry` — battle actions had no audio
 * feedback at all before this (only the ambient `playBattleMusic` track), a real gap
 * once real attacks/moves were the newest, most-played part of the game. Reuses the
 * same jingle vocabulary `ResolutionOverlay` already uses for a whole action's
 * success/fail rather than inventing new sounds: a plain landed hit is the lighter
 * `blip` (these happen often — a full `success` chime on every single swing would wear
 * out fast), a KO gets the rarer, bigger `success` payoff, a heal or Melania's curse
 * gets the neutral-positive `confirm`, and anything that *didn't* land (a dodge, Trump's
 * flee quirk, a fizzled charm with no ally to redirect to) gets `cancel`/`fail` — the
 * same "that didn't happen" cues the rest of the UI already uses. A `switch` over every
 * `BattleLogEntry.kind` (not an `if` chain) so adding a new log kind without a case here
 * is a compile error, not a silently-unheard attack — same exhaustiveness discipline as
 * `engine/preview.ts`'s `summarizeEffects` (see `CLAUDE.md`'s note on the `unflag` bug
 * that pattern was added to catch).
 */
function sfxForLogEntry(entry: BattleLogEntry): SfxId {
  switch (entry.kind) {
    case 'attack':
      return entry.defeated ? 'success' : entry.healed ? 'confirm' : 'blip';
    case 'flee':
      return 'cancel';
    case 'dodge':
      return 'fail';
    case 'charm':
      if (!entry.allyId) return 'cancel';
      return entry.allyDefeated ? 'success' : 'blip';
    case 'curse':
      return 'confirm';
  }
}

/**
 * One roster row: the swatch and full unit name on their own line, then an HP bar (with
 * the actual number next to it — user feedback asked to be able to see HP, not just
 * infer it from a bar's width) on a line below, plus, for the two units with a `magic`
 * pool (Carney, Melania), a row of MP pips below that — filled left to right as
 * `magicCharge` builds toward `magic.max`, per `engine/battle.ts`'s doc comment.
 *
 * Was a single `display:flex` row (swatch + name + stat column all side by side) —
 * inside the 92px-wide `.battle-roster-compact` panel that squeezed `.battle-roster-name`
 * down to almost nothing, so most names ellipsized after two or three letters ("Po...",
 * "Ha..."). User feedback: "I would prefer the HP/MP be on a line below the name."
 * Splitting the row into a name line (`.battle-roster-top`) and a stats line
 * (`.battle-stat-col`, now full-width instead of a narrow trailing column) gives the name
 * the whole panel width to itself. */
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
      <span className="battle-roster-top">
        {unit.sprite ? (
          // Always the `front` pose here regardless of `unit.facing` — this is a tiny
          // 12px roster-list icon, not the battlefield token (`BattleUnitToken` below,
          // which does turn with `spriteForFacing`); animating a thumbnail this small
          // wouldn't read as anything but flicker.
          <img className="battle-roster-swatch" src={unit.sprite.front} alt="" aria-hidden="true" />
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
      </span>
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
                  className={
                    i < unit.magicCharge ? 'battle-magic-pip is-filled' : 'battle-magic-pip'
                  }
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

/** Maps a `TerrainKind` to the `.battle-terrain-*` modifier class that paints it (see
 * `styles/battle.css`) — `undefined` for a country whose `data/battlegrounds/<id>.json`
 * has no `"terrain"` key yet leaves the tile with no terrain class at all, so it renders
 * exactly as it always has (a plain colored diamond/box). */
function terrainClass(terrain: TerrainKind | undefined): string {
  return terrain ? `battle-terrain-${terrain}` : '';
}

/** One battlefield cell. Three render shapes, not two — added alongside the per-country
 * terrain system (`data/battlegrounds.ts`, GAME_PLAN §7.1):
 * - `tile === 'wall'` with a `BLOCK_TERRAIN` kind (`'cliff'`, or one of the three
 *   waterfall kinds — see `data/battlegrounds.ts`'s own doc comment) or no terrain at
 *   all (every country before this system existed): the original tall extruded
 *   `IsoBlock` — a rock face or a waterfall genuinely should stand up off the field.
 * - `tile === 'wall'` with any other terrain (e.g. `'water'`, `'shoreRock'`, or a grassy
 *   tile a tree prop stands on): a flat, non-interactive, textured diamond — impassable
 *   per the engine's plain `floor`/`wall` grid either way, but a river or a tree-stump
 *   patch shouldn't stand up like a rock does.
 * - `tile === 'floor'`: the original clickable diamond, now with an optional terrain
 *   texture and (for the attackable highlight) an overlay span rather than a flat
 *   `background` color, since a `background` shorthand would otherwise blank out
 *   whatever terrain texture is already painted there.
 */
function BattleTile({
  tile,
  pos,
  point,
  terrain,
  highlight,
  occupant,
  disabled,
  onClick,
  t,
}: {
  tile: TileKind;
  pos: GridPosition;
  point: IsoPoint;
  terrain?: TerrainKind;
  highlight: 'reachable' | 'attackable' | null;
  /** The living unit standing on this tile, if any — real accessibility gap found on a
   * polish pass: every tile's `aria-label` used to be just its raw grid coordinate
   * (`"5,3"`), so a screen-reader user navigating the battle grid heard an
   * undifferentiated list of coordinates with no way to tell an empty tile from a
   * reachable one, an ally, or an attackable enemy — the whole point of the highlight
   * colors a sighted player relies on. Threading the occupant (and `highlight`) into a
   * real label fixes that without changing anything visual. */
  occupant?: BattleUnit;
  disabled: boolean;
  onClick: () => void;
  t: TFunction;
}) {
  const depth = isoDepth(pos);
  const key = posKey(pos.x, pos.y);
  const label = occupant
    ? t(highlight === 'attackable' ? 'battle.tile.attackable' : 'battle.tile.occupied', {
        name: unitLabel(occupant, t),
        x: pos.x,
        y: pos.y,
      })
    : t(highlight === 'reachable' ? 'battle.tile.reachable' : 'battle.tile.empty', {
        x: pos.x,
        y: pos.y,
      });

  if (tile === 'wall') {
    if (terrain === undefined || BLOCK_TERRAIN.has(terrain)) {
      return (
        <IsoBlock
          key={key}
          point={point}
          depth={depth}
          height={ISO_WALL_HEIGHT}
          faces={CUBE_FACES_WALL}
          className={`iso-wall ${terrainClass(terrain)}`}
        />
      );
    }
    return (
      <div
        key={key}
        className={`iso-diamond iso-floor ${terrainClass(terrain)}`}
        style={{ left: point.x, top: point.y, zIndex: depth * 10 }}
      />
    );
  }

  const classes = [
    'iso-diamond',
    'iso-floor',
    terrainClass(terrain),
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
      aria-label={label}
    >
      {/* A `background` overlay, not `background-color` on the diamond itself — either
       * would paint *under* a terrain `background-image`, invisibly, since terrain
       * textures are fully opaque crops (see `data/battlegrounds.ts`'s doc comment).
       * Both overlays pulse (`@keyframes battle-tile-flash`, `battle.css`) — a flat
       * highlight (this used to be a static `filter: brightness()` on the tile itself)
       * was too subtle to notice over a busy terrain texture, per real user feedback:
       * "I don't see when I can move. It should be flashing as well." */}
      {highlight === 'reachable' ? <span className="battle-tile-reachable-overlay" /> : null}
      {highlight === 'attackable' ? <span className="battle-tile-attackable-overlay" /> : null}
    </button>
  );
}

/** A non-interactive decoration (tree, building, fence...) from a country's
 * `BattlegroundLayout.props` (`data/battlegrounds.ts`) — anchored bottom-center to its
 * tile like `BattleUnitToken`, and given the same `isoDepth`-based `zIndex` scheme, so a
 * unit correctly paints in front of a prop it's standing in front of on screen (and
 * behind one further from the camera) even though every prop is rendered as one batch,
 * separately from the tile/unit loops above and below it — z-index is explicit on all
 * three (never `auto`), so paint order follows it, not DOM order. `pointer-events: none`
 * (`.battle-prop`, `battle.css`): every prop sits on an already-impassable `wall` cell,
 * so there's nothing to click here, just something to not accidentally intercept a click
 * meant for whatever's underneath. */
function BattleProp({ prop, bounds }: { prop: BattlegroundProp; bounds: IsoBounds }) {
  const point = projectIsoWithin(prop.pos, bounds);
  const depth = isoDepth(prop.pos);
  return (
    <img
      src={prop.image}
      alt=""
      aria-hidden="true"
      className="battle-prop"
      style={{ left: point.x, top: point.y, zIndex: depth * 10 + 1 }}
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
 * check just above it.
 *
 * The sprite itself picks its pose via `spriteForFacing(unit.sprite, unit.facing)`
 * rather than always `unit.sprite.front` (user feedback: "it would be nice that the
 * sprites turns in the direction of where it's going or where it attacks") — `facing`
 * is real `BattleState` on the unit, turned by `moveUnit`/`attack` in `engine/battle.ts`
 * itself, so this component stays a dumb renderer of whatever direction the engine says
 * the unit is currently facing rather than trying to infer it here from position deltas
 * across renders. */
function BattleUnitToken({
  unit,
  point,
  isCurrent,
  badge,
  color,
  isOccluding,
}: {
  unit: BattleUnit;
  point: IsoPoint;
  isCurrent: boolean;
  badge?: string;
  color: string;
  /** True when this unit's own sprite is currently covering enough of a teammate
   * standing behind it to hide their face (`spriteOcclusion.ts`) — fades just the
   * sprite (`.is-occluding` in `battle.css`), not the flag/badge or turn marker, since
   * seeing through a teammate's body is the ask, not their pastille or whose turn it is. */
  isOccluding: boolean;
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
        <img
          className={isOccluding ? 'battle-unit-sprite is-occluding' : 'battle-unit-sprite'}
          src={spriteForFacing(unit.sprite, unit.facing)}
          alt=""
          aria-hidden="true"
        />
      ) : (
        <div
          className={
            isOccluding
              ? 'battle-unit-sprite battle-unit-placeholder is-occluding'
              : 'battle-unit-sprite battle-unit-placeholder'
          }
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

/** Lets a caller other than `ResolutionOverlay` drive this same screen with its own
 * battle state instead of the store's `resolution.battle`/`battleCountry` — added for
 * the opening cutscene's free/no-stat-effect Canada battle (`ui/screens/IntroScreen.tsx`,
 * see GAME_PLAN's opening-cutscene feature), which deliberately runs a battle *outside*
 * `resolution` entirely so its outcome never reaches `resolveBattleAction`/applies a real
 * stat delta. Every field is optional and falls back to the store's own `resolution`
 * exactly as before — `ResolutionOverlay`'s existing `<BattleView />` call site (no
 * props) is completely unaffected by this. A lighter-weight "props override the store"
 * shim was chosen over refactoring this whole 800+-line component to *always* take props
 * (and threading them through `ResolutionOverlay` too) — much less risk of regressing the
 * real declare-war flow for a feature that only needs one more caller. */
export interface BattleViewProps {
  readonly battle?: BattleState;
  readonly battleCountry?: CountryId;
  /** Called instead of the store's `battleMove` when `battle` is supplied. */
  readonly onMove?: (pos: GridPosition) => void;
  /** Called instead of the store's `battleAttack` when `battle` is supplied. */
  readonly onAttack?: (targetId: string) => void;
  /** Called instead of the store's `battleEndTurn` when `battle` is supplied. */
  readonly onEndTurn?: () => void;
  /** Called instead of the store's `battleRunEnemyTurn` when `battle` is supplied. */
  readonly onRunEnemyTurn?: () => void;
}

/**
 * The tactical battle screen (GAME_PLAN §7.1): declaring war plays out here instead of
 * an instant roll. Rendered on the same isometric camera as the room view (`ui/room/`,
 * GAME_PLAN §11) rather than a flat grid, so the battle doesn't look like a different
 * game — it reuses `ui/room/isometric.ts`'s projection math and `IsoBlocks.tsx`'s tile
 * primitives, adding only what's battle-specific (clickable tiles, unit tokens).
 */
export function BattleView(props: BattleViewProps = {}) {
  const t = useT();
  const resolution = useGameStore((s) => s.resolution);
  const storeBattleMove = useGameStore((s) => s.battleMove);
  const storeBattleAttack = useGameStore((s) => s.battleAttack);
  const storeBattleEndTurn = useGameStore((s) => s.battleEndTurn);
  const storeBattleRunEnemyTurn = useGameStore((s) => s.battleRunEnemyTurn);

  const battleMove = props.onMove ?? storeBattleMove;
  const battleAttack = props.onAttack ?? storeBattleAttack;
  const battleEndTurn = props.onEndTurn ?? storeBattleEndTurn;
  const battleRunEnemyTurn = props.onRunEnemyTurn ?? storeBattleRunEnemyTurn;

  const battle = props.battle ?? (resolution?.phase === 'battle' ? resolution.battle : undefined);
  const battleCountry =
    props.battleCountry ?? (resolution?.phase === 'battle' ? resolution.battleCountry : undefined);

  const battleForEffect = battle;
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

  // Per-attack sound cue (`sfxForLogEntry` above) — real user-facing gap: battle actions
  // had no audio feedback of their own, only the ambient music track. Keyed on the log's
  // *length*, not its last entry, so this only fires for a genuinely new entry, not a
  // re-render; covers the player's own attacks and the enemy's alike, since
  // `battleRunEnemyTurn` appends to this same `battle.log`, so one effect handles both
  // instead of needing a second copy wired into the enemy-turn effect above.
  const battleLogLength = battleForEffect?.log.length ?? 0;
  useEffect(() => {
    if (!battleForEffect || battleLogLength === 0) return;
    const entry = battleForEffect.log[battleLogLength - 1];
    if (entry) playSfx(sfxForLogEntry(entry));
  }, [battleForEffect, battleLogLength]);

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
  // Real user feedback: "The battle should start zoomed out." Starts at `ZOOM_MIN`
  // rather than 1× so the whole 20×14 map is visible (or as close to it as the viewport
  // allows) the instant a battle opens, instead of requiring a manual zoom-out first.
  const [zoom, setZoom] = useState(ZOOM_MIN);
  // `useBattleCamera`/`battleCamera.ts`'s clamp/center math works in on-screen px, but
  // `boundsForEffect`/`followPointForEffect` are in the grid's own *unscaled* local
  // space (the space `.battle-grid-iso`'s children are actually positioned in below) —
  // scaling both by `zoom` before handing them to the camera hook is what keeps
  // `camera.x`/`camera.y` themselves correct as plain viewport-space translate values
  // regardless of zoom (see the `ZOOM_MIN`/`ZOOM_MAX` doc comment above for why that's
  // safe to do without touching `camera` itself).
  const zoomedBoundsForEffect = {
    width: boundsForEffect.width * zoom,
    height: boundsForEffect.height * zoom,
  };
  const zoomedFollowPointForEffect = {
    x: followPointForEffect.x * zoom,
    y: followPointForEffect.y * zoom,
  };
  // Keyed on the active unit's position too, not just its id, so moving the active unit
  // during its own turn re-centers the camera on it again, not just a turn change.
  // Deliberately does *not* include `zoom` any more (real user feedback: "the zoom
  // should be on the mouse cursor position, not on the current player") — zooming used
  // to force a recenter on the active unit through this key changing; now a zoom is
  // handled entirely by `zoomAt` below (via `setCameraFor`), which repositions the
  // camera around whatever point was zoomed on instead of yanking it back to the active
  // unit. A turn change still recenters using whatever the *current* zoom level is,
  // since `zoomedBoundsForEffect`/`zoomedFollowPointForEffect` are always computed
  // fresh from the current `zoom` state regardless of what's in this key.
  const followKeyForEffect = activeForEffect
    ? `${activeForEffect.id}:${activeForEffect.pos.x},${activeForEffect.pos.y}`
    : 'none';
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewportSize = useElementSize(viewportRef);
  const { camera, pan, setCameraFor } = useBattleCamera(
    zoomedBoundsForEffect,
    viewportSize,
    zoomedFollowPointForEffect,
    followKeyForEffect,
    ROSTER_PANEL_WIDTH,
  );
  const scale = useStageScale();
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ x: number; y: number; dragging: boolean } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    viewportRef.current?.focus();
  }, []);

  if (!battle || !battleCountry) {
    return null;
  }

  // Per-country terrain/props (GAME_PLAN §7.1, `data/battlegrounds.ts`) — looked up here
  // by country rather than threaded through `resolution`, since it's a cheap, pure
  // function of `battleCountry` alone; a country whose JSON has no `terrain`/`props` key
  // yet renders exactly as this screen always did before this file existed.
  const battleground = getBattleground(battleCountry);
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
  // Real user feedback, screenshot of the spawn formation: a front-row unit's tall
  // sprite completely hid a teammate standing diagonally behind it. Originally checked
  // every pair on the field (`occludingUnitIds`), but a later round of feedback narrowed
  // the scope: "The only [units] in front and around the USA current playing player
  // should be semi transparent" — fading some unrelated pair elsewhere on the field read
  // as distracting noise, since what actually matters is always being able to see the
  // unit you're currently deciding a move for. `unitsOccludingActive` only looks at
  // units covering `active` itself. Recomputed every render off `living`'s current
  // positions (cheap — well under 20 units on the field at once) rather than memoized,
  // matching this component's existing style of recomputing these small derived
  // filters/sets fresh each render (`usUnits`/`enemyUnits` above).
  const occludingIds = unitsOccludingActive(living, active.id);
  const lastLog = battle.log[battle.log.length - 1];
  const enemyCountry = getCountry(battleCountry);
  const unitColor = (unit: BattleUnit) => (unit.side === 'us' ? US_COLOR : enemyCountry.color);
  const unitBadge = (unit: BattleUnit) => (unit.side === 'us' ? US_BADGE : enemyCountry.badge);

  const handleTileClick = (x: number, y: number) => {
    if (!isPlayerTurn) return;
    const key = posKey(x, y);
    const occupant = living.find((u) => u.pos.x === x && u.pos.y === y);
    if (occupant && targetIds.has(occupant.id)) {
      // No `playSfx` call here — the log-watching effect above already covers every
      // attack (player's and enemy's alike) from `battle.log`, so adding one here would
      // just double it up.
      battleAttack(occupant.id);
      return;
    }
    // Moves don't append a `BattleLogEntry` (only combat actions do), so this is the one
    // battle sound that has to fire from the click itself rather than the log effect —
    // same lightweight `blip` the rest of the UI already uses for "a click did something."
    if (reachableKeys.has(key)) {
      playSfx('blip');
      battleMove({ x, y });
    }
  };

  // Zooms around `anchor` (a point in `.battle-viewport`-local px — the same coordinate
  // space `camera.x/y` live in, see the `ZOOM_MIN`/`ZOOM_MAX` doc comment above) rather
  // than always recentering on the active unit: finds the grid-local point currently
  // under `anchor` at the *old* zoom, then solves for the camera offset that puts that
  // same grid-local point back under `anchor` at the *new* zoom — the standard
  // "zoom to a point" trick a map app uses so whatever you're pointing at stays put
  // while everything around it scales. `nextGridSize` (the grid's on-screen footprint
  // *at the new zoom*) is computed here from the unscaled `bounds`, rather than read off
  // `zoomedBoundsForEffect`, since that still reflects the *current* render's zoom —
  // `setCameraFor` needs the size the grid is *about* to become.
  const zoomAt = (nextZoom: number, anchor: { x: number; y: number }) => {
    const clamped = clampZoom(nextZoom);
    if (clamped === zoom) return;
    const gridX = (anchor.x - camera.x) / zoom;
    const gridY = (anchor.y - camera.y) / zoom;
    setZoom(clamped);
    setCameraFor(
      { x: anchor.x - gridX * clamped, y: anchor.y - gridY * clamped },
      { width: bounds.width * clamped, height: bounds.height * clamped },
    );
  };

  // Anchor for the +/- buttons and keyboard shortcuts, neither of which has a
  // meaningful cursor position over the map itself (a button click's cursor is off in a
  // viewport corner) — the viewport's own center is the least surprising default,
  // keeping whatever's currently in the middle of the view in the middle after zooming.
  const viewportCenter = { x: viewportSize.width / 2, y: viewportSize.height / 2 };
  const zoomIn = () => zoomAt(zoom + ZOOM_STEP, viewportCenter);
  const zoomOut = () => zoomAt(zoom - ZOOM_STEP, viewportCenter);

  const handleViewportKeyDown = (event: KeyboardEvent) => {
    const delta = KEY_PAN[event.key];
    if (delta) {
      event.preventDefault();
      pan(delta[0], delta[1]);
      return;
    }
    // '=' is the unshifted key '+' shares on most keyboards, so both zoom in.
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomOut();
    }
  };

  // Wheel-to-zoom, same spirit as a map app: scrolling up zooms in, anchored on the
  // cursor's actual position over the map (real user feedback: "the zoom should be on
  // the mouse cursor position, not on the current player") rather than the viewport
  // center `zoomIn`/`zoomOut` fall back to. `.battle-viewport` has nothing else that
  // scrolls (the grid pans by drag/arrow-keys instead, never by native scroll), so
  // there's no competing behavior to preserve here. Divided by `scale` for the same
  // reason `handleViewportPointerMove`'s drag delta is — `event.clientX/Y` are real
  // screen px, but `camera.x/y` (and so `anchor`) live in stage-internal px, one more
  // factor smaller whenever the whole game is zoomed above 1× by `useStageScale`.
  const handleViewportWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    const anchor = rect
      ? {
          x: (event.clientX - rect.left) / (scale || 1),
          y: (event.clientY - rect.top) / (scale || 1),
        }
      : viewportCenter;
    if (event.deltaY < 0) zoomAt(zoom + ZOOM_STEP, anchor);
    else if (event.deltaY > 0) zoomAt(zoom - ZOOM_STEP, anchor);
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

  // Real user feedback: hide "the bar 'Battle 1: Canada...'" — the `<h2>` title plus the
  // round-count line that used to sit above the map, taking up vertical space on a
  // battle screen that's otherwise meant to be full-screen (see the earlier "bigger
  // battlefield" entry in CLAUDE.md). The same information isn't lost, just moved off
  // the visible layout: it's now the dialog's own `aria-label`, so a screen reader still
  // announces which country and which round this is, even though there's no longer a
  // visible bar for a sighted player to read it from.
  const battleDialogLabel = `${t('battle.title', { country: t(getCountry(battleCountry).nameKey) })} — ${t('battle.round', { n: battle.round })}`;

  return (
    <div
      className="menu-overlay battle-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={battleDialogLabel}
    >
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
          onWheel={handleViewportWheel}
        >
          <div className="battle-zoom-controls">
            <button
              type="button"
              className="pixel-button battle-zoom-button"
              onClick={zoomOut}
              disabled={zoom <= ZOOM_MIN}
              aria-label={t('battle.zoom.out')}
            >
              −
            </button>
            <button
              type="button"
              className="pixel-button battle-zoom-button"
              onClick={zoomIn}
              disabled={zoom >= ZOOM_MAX}
              aria-label={t('battle.zoom.in')}
            >
              +
            </button>
          </div>
          <div
            className="battle-grid-iso"
            style={{
              width: bounds.width,
              height: bounds.height,
              transform: `translate(${camera.x}px, ${camera.y}px) scale(${zoom})`,
              transformOrigin: 'top left',
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
                const occupant = living.find((u) => u.pos.x === x && u.pos.y === y);
                return (
                  <BattleTile
                    key={key}
                    tile={tile}
                    pos={pos}
                    point={projectIsoWithin(pos, bounds)}
                    highlight={highlight}
                    occupant={occupant}
                    disabled={!isPlayerTurn}
                    terrain={battleground.terrain?.[y]?.[x]}
                    onClick={() => handleTileClick(x, y)}
                    t={t}
                  />
                );
              }),
            )}
            {(battleground.props ?? []).map((prop) => (
              <BattleProp
                key={`${prop.pos.x},${prop.pos.y}:${prop.image}`}
                prop={prop}
                bounds={bounds}
              />
            ))}
            {living.map((u) => (
              <BattleUnitToken
                key={u.id}
                unit={u}
                point={projectIsoWithin(u.pos, bounds)}
                isCurrent={active.id === u.id}
                badge={unitBadge(u)}
                color={unitColor(u)}
                // `occludingIds` (`unitsOccludingActive`, above) never includes
                // `active.id` itself, so the unit whose turn it is never fades here —
                // real user report, screenshot mid-battle: "Melania is playing. She
                // shouldn't be transparent" (she'd been caught by the old whole-roster
                // occlusion check, which has since been narrowed to just this).
                isOccluding={occludingIds.has(u.id)}
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
