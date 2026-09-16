import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { STAGE_HEIGHT, STAGE_WIDTH } from './ui/constants';
import { MuteToggle } from './ui/audio/MuteToggle';
import { startAmbientHum, stopAmbientHum } from './ui/audio/sfx';
import { Hud } from './ui/hud/Hud';
import { Ticker } from './ui/hud/Ticker';
import { LangToggle } from './ui/menus/LangToggle';
import { EndingScreen } from './ui/screens/EndingScreen';
import { GameScreen } from './ui/screens/GameScreen';
import { MonthEndReport } from './ui/screens/MonthEndReport';
import { TitleScreen } from './ui/screens/TitleScreen';
import { useStageScale } from './ui/useStageScale';

function CurrentScreen() {
  const screen = useGameStore((s) => s.screen);
  switch (screen) {
    case 'title':
      return <TitleScreen />;
    case 'game':
      return <GameScreen />;
    case 'monthReport':
      return <MonthEndReport />;
    case 'ending':
      return <EndingScreen />;
    default:
      return null;
  }
}

export function App() {
  const scale = useStageScale();
  const lang = useGameStore((s) => s.lang);
  const screen = useGameStore((s) => s.screen);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // The ambient hum only fits the room/battle screen — off everywhere else (title,
  // month report, ending), and always stopped on unmount so it never outlives the stage.
  useEffect(() => {
    if (screen === 'game') {
      startAmbientHum();
    } else {
      stopAmbientHum();
    }
    return () => stopAmbientHum();
  }, [screen]);

  return (
    <div className="viewport">
      <div
        className="stage"
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `scale(${scale})` }}
      >
        <Hud />
        <CurrentScreen />
        <LangToggle />
        <MuteToggle />
        <Ticker />
      </div>
    </div>
  );
}
