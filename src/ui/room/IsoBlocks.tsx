import type { CSSProperties } from 'react';
import { ISO_TILE_HEIGHT, ISO_TILE_WIDTH, type CubeClipPaths, type IsoPoint } from './isometric';

/**
 * The two visual building blocks of every isometric scene (GAME_PLAN §11): a flat
 * diamond tile and an extruded cube block. Shared by the room camera (`RoomView`) and
 * the tactical battle screen (`ui/battle/BattleView`, GAME_PLAN §7.1) so both isometric
 * scenes render tiles and walls identically instead of duplicating this markup.
 */

/** A flat diamond tile (floor, door, or a battle tile's clickable highlight) centered
 * on `point`. */
export function IsoDiamond({
  point,
  depth,
  className,
}: {
  point: IsoPoint;
  depth: number;
  className: string;
}) {
  const style: CSSProperties = {
    left: point.x,
    top: point.y,
    zIndex: depth * 10,
  };
  return <div className={`iso-diamond ${className}`} style={style} />;
}

/** An extruded block (wall or object) standing `height` tall above its tile, centered
 * on `point`. Three faces (`faces`) give it a simple isometric-cube look via clip-path. */
export function IsoBlock({
  point,
  depth,
  height,
  faces,
  className,
  zBoost = 0,
}: {
  point: IsoPoint;
  depth: number;
  height: number;
  faces: CubeClipPaths;
  className: string;
  zBoost?: number;
}) {
  const halfW = ISO_TILE_WIDTH / 2;
  const halfH = ISO_TILE_HEIGHT / 2;
  const style: CSSProperties = {
    left: point.x - halfW,
    top: point.y - halfH,
    width: ISO_TILE_WIDTH,
    height: ISO_TILE_HEIGHT + height,
    zIndex: depth * 10 + zBoost,
  };
  return (
    <div className={`iso-block ${className}`} style={style}>
      <div className="iso-face iso-face-top" style={{ clipPath: faces.top }} />
      <div
        className="iso-face iso-face-left"
        style={{ top: halfH, width: halfW, height: halfH + height, clipPath: faces.left }}
      />
      <div
        className="iso-face iso-face-right"
        style={{
          top: halfH,
          left: halfW,
          width: halfW,
          height: halfH + height,
          clipPath: faces.right,
        }}
      />
    </div>
  );
}
