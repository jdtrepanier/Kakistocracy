import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { getCharacter, spriteForDirection } from '@/data/characters';
import { facingItem, getRoomLayout } from '@/data/roomLayouts';
import { step, tileAt, type Direction, type GridPosition, type TileKind } from '@/engine/movement';
import { useGameStore } from '@/store/gameStore';
import { useT } from '../useT';
import { IsoBlock, IsoDiamond } from './IsoBlocks';
import {
  CUBE_FACES_OBJECT,
  CUBE_FACES_WALL,
  ISO_WALL_HEIGHT,
  ISO_OBJECT_HEIGHT,
  ROOM_MOVE_TRANSITION_MS,
  isoDepth,
  isoGridBounds,
  projectIsoWithin,
  type IsoPoint,
} from './isometric';
import { holdPlayerDepth, settlePlayerDepth, type PlayerDepthHold } from './playerDepth';
import { useElementSize } from './useElementSize';

const KEY_DIRECTION: Readonly<Record<string, Direction>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

/** One grid cell's rendered elements — a plain diamond for floor/door, an extruded
 * block for a wall, or a floor diamond plus a shorter block for an object. */
function renderCell(tile: TileKind, pos: GridPosition, point: IsoPoint): ReactNode[] {
  const key = `${pos.x}-${pos.y}`;
  const depth = isoDepth(pos);

  if (tile === 'wall') {
    return [
      <IsoBlock
        key={key}
        point={point}
        depth={depth}
        height={ISO_WALL_HEIGHT}
        faces={CUBE_FACES_WALL}
        className="iso-wall"
      />,
    ];
  }

  if (tile === 'object') {
    return [
      <IsoDiamond key={`${key}-floor`} point={point} depth={depth} className="iso-floor" />,
      <IsoBlock
        key={`${key}-object`}
        point={point}
        depth={depth}
        height={ISO_OBJECT_HEIGHT}
        faces={CUBE_FACES_OBJECT}
        className="iso-object"
        zBoost={1}
      />,
    ];
  }

  // A grabbable item's pedestal — same extruded-block shape as a DECREE object, just a
  // distinct gold-toned `iso-item` face (`room.css`) so it reads as "something you can
  // pick up" rather than "something you interact with in place." Stays exactly like this
  // even once collected (see `TileKind`'s own doc comment: it's real furniture, not the
  // item floating on its own) — only the ITEM-button hint and pickup logic (`RoomView`'s
  // own `showItemHint` below, `CrossMenu.tsx`) change based on collected state.
  if (tile === 'item') {
    return [
      <IsoDiamond key={`${key}-floor`} point={point} depth={depth} className="iso-floor" />,
      <IsoBlock
        key={`${key}-item`}
        point={point}
        depth={depth}
        height={ISO_OBJECT_HEIGHT}
        faces={CUBE_FACES_OBJECT}
        className="iso-item"
        zBoost={1}
      />,
    ];
  }

  const className = tile === 'door' ? 'iso-door' : 'iso-floor';
  return [<IsoDiamond key={key} point={point} depth={depth} className={className} />];
}

/** Holds the player token's paint-order depth at the max of its old and new tile for
 * the length of the CSS position glide (`ROOM_MOVE_TRANSITION_MS`), only settling to
 * the new tile's true depth once the glide finishes. This is the React glue only — the
 * actual hold/settle decision is `playerDepth.ts`'s pure `holdPlayerDepth`/
 * `settlePlayerDepth`, which has its own regression tests covering exactly the bug this
 * hook exists to prevent (see that file's doc comment for the full explanation). */
function usePlayerDepth(depth: number, roomId: string): number {
  const [hold, setHold] = useState<PlayerDepthHold>(() => settlePlayerDepth(depth, roomId));
  const holdRef = useRef(hold);

  useEffect(() => {
    const next = holdPlayerDepth(holdRef.current, depth, roomId);
    holdRef.current = next;
    setHold(next);
    const timer = setTimeout(() => {
      const settled = settlePlayerDepth(depth, roomId);
      holdRef.current = settled;
      setHold(settled);
    }, ROOM_MOVE_TRANSITION_MS);
    return () => clearTimeout(timer);
  }, [depth, roomId]);

  return hold.depth;
}

/** The isometric room camera (GAME_PLAN §11, pre-Phase-4 pivot to a Sims-style dollhouse
 * view): arrow keys / WASD move and turn the party; bumping into the room's object shows
 * a hint to open DECREE. The projection math lives in `isometric.ts`, so swapping this
 * placeholder for a real PixiJS isometric renderer later only touches this file. */
export function RoomView() {
  const t = useT();
  const player = useGameStore((s) => s.player);
  const activeCharacter = useGameStore((s) => s.activeCharacter);
  const movePlayer = useGameStore((s) => s.movePlayer);
  const items = useGameStore((s) => s.game.items);
  const viewportRef = useRef<HTMLDivElement>(null);
  const viewportSize = useElementSize(viewportRef);

  useEffect(() => {
    viewportRef.current?.focus();
  }, []);

  const handleKeyDown = (event: KeyboardEvent) => {
    const dir = KEY_DIRECTION[event.key];
    if (!dir) return;
    event.preventDefault();
    movePlayer(dir);
  };

  const layout = getRoomLayout(player.roomId);
  const character = getCharacter(activeCharacter);
  const facingTile = tileAt(layout.grid, step(player.pos, player.facing));
  const facingObject = facingTile === 'object';
  const facingItemId = facingItem(player.roomId, player.pos, player.facing);
  // Still shows the "press ITEM" hint even once collected — same "the pedestal is real
  // furniture, whether or not its item's been taken" spirit as `TileKind`'s own doc
  // comment — but only if there's actually still something to grab; an already-collected
  // item's hint would just be confusing ("press ITEM" for nothing to happen).
  const showItemHint = facingItemId !== undefined && !items.includes(facingItemId);

  const bounds = isoGridBounds(layout.grid);
  const playerPoint = projectIsoWithin(player.pos, bounds);
  const playerDepth = isoDepth(player.pos);
  const playerZDepth = usePlayerDepth(playerDepth, player.roomId);
  const cameraX = viewportSize.width / 2 - playerPoint.x;
  const cameraY = viewportSize.height / 2 - playerPoint.y;

  const tiles = layout.grid.flatMap((row, y) =>
    row.flatMap((tile, x) => {
      const pos = { x, y };
      return renderCell(tile, pos, projectIsoWithin(pos, bounds));
    }),
  );

  return (
    <div
      ref={viewportRef}
      className="room-viewport"
      role="application"
      tabIndex={0}
      aria-label={t('room.viewport.label')}
      onKeyDown={handleKeyDown}
    >
      <div
        className="room-iso-world"
        style={{
          width: bounds.width,
          height: bounds.height,
          transform: `translate(${cameraX}px, ${cameraY}px)`,
        }}
      >
        {tiles}
        <div
          className="room-player-shadow"
          style={{ left: playerPoint.x, top: playerPoint.y, zIndex: playerDepth * 10 + 4 }}
          aria-hidden="true"
        />
        <img
          className="room-player"
          src={spriteForDirection(character.sprite, player.facing)}
          style={{
            left: playerPoint.x,
            top: playerPoint.y,
            zIndex: playerZDepth * 10 + 5,
          }}
          alt=""
          aria-hidden="true"
        />
      </div>
      {facingObject && <div className="room-hint">{t('room.hint.object')}</div>}
      {showItemHint && <div className="room-hint">{t('room.hint.item')}</div>}
    </div>
  );
}
