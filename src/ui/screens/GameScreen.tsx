import { useGameStore } from '@/store/gameStore';
import { playSfx } from '../audio/sfx';
import { CrossMenu } from '../menus/CrossMenu';
import { StubOverlay } from '../menus/StubOverlay';
import { OfficialWindow } from '../room/OfficialWindow';
import { RoomView } from '../room/RoomView';
import { RoomWindow } from '../room/RoomWindow';
import { useT } from '../useT';
import { ActionsOverlay } from './ActionsOverlay';
import { MapScreen } from './MapScreen';
import { ResolutionOverlay } from './ResolutionOverlay';

/** The Phase 2 room slice (GAME_PLAN §11): official/room windows, a walkable room,
 * the cross menu, and the toolbar for what isn't tied to a room object yet. */
export function GameScreen() {
  const t = useT();
  const overlay = useGameStore((s) => s.overlay);
  const resolution = useGameStore((s) => s.resolution);
  const openOverlay = useGameStore((s) => s.openOverlay);
  const roomId = useGameStore((s) => s.player.roomId);
  const endMonth = useGameStore((s) => s.endMonth);

  // Real accessibility/state-corruption gap found on a polish pass: every overlay below
  // (`ActionsOverlay`/`MapScreen`/`StubOverlay`/`ResolutionOverlay`, the last of which
  // covers the showdown/preview/battle/result flow too) is layered on top of this room
  // content with CSS, not swapped in for it — so without this, the room content stayed
  // mounted, focusable and keyboard-reachable underneath any of them. A keyboard user
  // could Tab straight past a modal into, say, the still-live End Month button
  // (`store/gameStore.ts`'s `endMonth` now also guards against firing mid-resolution as
  // a second layer of defense — this fixes the reachability itself, that fixed the
  // consequence of reaching it anyway). `inert` (real HTML attribute, not a shim of one)
  // removes this whole subtree from both the tab order and the accessibility tree in one
  // line, with no hand-rolled focus trap needed — the same reason it's the modern
  // replacement for `aria-hidden` + manual `tabIndex="-1"` juggling.
  const backgroundInert = overlay !== null || resolution !== null;

  return (
    <main className="game-screen">
      <div className="game-screen-content" inert={backgroundInert}>
        <div className="room-chrome">
          <OfficialWindow />
          <RoomWindow />
        </div>
        <div className="room-viewport-wrap">
          <RoomView />
          <CrossMenu />
        </div>
        <div className="toolbar">
          <button
            type="button"
            className="pixel-button toolbar-button"
            onClick={() => {
              playSfx('blip');
              openOverlay('actions');
            }}
          >
            {t('toolbar.actions')}
          </button>
          <button
            type="button"
            className="pixel-button toolbar-button"
            onClick={() => {
              playSfx('blip');
              openOverlay('map');
            }}
          >
            {t('toolbar.map')}
          </button>
          <button
            type="button"
            className="pixel-button toolbar-button"
            onClick={() => {
              playSfx('confirm');
              endMonth();
            }}
          >
            {t('screen.endMonth')}
          </button>
        </div>
      </div>

      {overlay === 'decree' && <ActionsOverlay room={roomId} />}
      {overlay === 'actions' && <ActionsOverlay />}
      {overlay === 'map' && <MapScreen />}
      {overlay === 'talk' && <StubOverlay titleKey="menu.talk" bodyKey="menu.talk.stub" />}
      {overlay === 'item' && <StubOverlay titleKey="menu.item" bodyKey="menu.item.stub" />}
      <ResolutionOverlay />
    </main>
  );
}
