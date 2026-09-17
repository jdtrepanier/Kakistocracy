import { useGameStore } from '@/store/gameStore';
import { playSfx } from '../audio/sfx';
import { CrossMenu } from '../menus/CrossMenu';
import { StubOverlay } from '../menus/StubOverlay';
import { OfficialWindow } from '../room/OfficialWindow';
import { RoomView } from '../room/RoomView';
import { RoomWindow } from '../room/RoomWindow';
import { TouchDPad } from '../room/TouchDPad';
import { useT } from '../useT';
import { ActionsOverlay } from './ActionsOverlay';
import { MapScreen } from './MapScreen';
import { ResolutionOverlay } from './ResolutionOverlay';

/** The Phase 2 room slice (GAME_PLAN §11): official/room windows, a walkable room,
 * the cross menu, and the toolbar for what isn't tied to a room object yet. */
export function GameScreen() {
  const t = useT();
  const overlay = useGameStore((s) => s.overlay);
  const openOverlay = useGameStore((s) => s.openOverlay);
  const roomId = useGameStore((s) => s.player.roomId);
  const endMonth = useGameStore((s) => s.endMonth);

  return (
    <main className="game-screen">
      <div className="room-chrome">
        <OfficialWindow />
        <RoomWindow />
      </div>
      <div className="room-viewport-wrap">
        <RoomView />
        <TouchDPad />
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

      {overlay === 'decree' && <ActionsOverlay room={roomId} />}
      {overlay === 'actions' && <ActionsOverlay />}
      {overlay === 'map' && <MapScreen />}
      {overlay === 'talk' && <StubOverlay titleKey="menu.talk" bodyKey="menu.talk.stub" />}
      {overlay === 'item' && <StubOverlay titleKey="menu.item" bodyKey="menu.item.stub" />}
      <ResolutionOverlay />
    </main>
  );
}
