import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { STAGE_HEIGHT, STAGE_WIDTH } from './ui/constants';
import { MuteToggle } from './ui/audio/MuteToggle';
import { HintButton } from './ui/HintButton';
import { Hud } from './ui/hud/Hud';
import { Ticker } from './ui/hud/Ticker';
import { LangToggle } from './ui/menus/LangToggle';
import { ScreenShake } from './ui/ScreenShake';
import { EndingScreen } from './ui/screens/EndingScreen';
import { GameScreen } from './ui/screens/GameScreen';
import { IntroScreen } from './ui/screens/IntroScreen';
import { MonthEndReport } from './ui/screens/MonthEndReport';
import { TitleScreen } from './ui/screens/TitleScreen';
import { useStageScale } from './ui/useStageScale';

function CurrentScreen() {
  const screen = useGameStore((s) => s.screen);
  switch (screen) {
    case 'title':
      return <TitleScreen />;
    case 'intro':
      return <IntroScreen />;
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
  // Real user feedback: hide the HUD bar during a battle (either the real declare-war
  // one, `resolution.phase === 'battle'`, or the free/no-stakes one the intro cutscene
  // runs, `introBattle !== null` — both render through the same `BattleView`, so both
  // need to be checked here rather than just one). This is a deliberate, narrow
  // exception to this file's own "the HUD and Ticker are always mounted, never
  // conditionally hidden per-screen" convention — battle is the one screen meant to be
  // full-screen (see CLAUDE.md's "bigger battlefield" entry), so the HUD's usual 26px
  // strip is reclaimed for the map specifically while a battle is on screen, not as a
  // per-`Screen` rule.
  const battleActive = useGameStore(
    (s) => s.resolution?.phase === 'battle' || s.introBattle !== null,
  );

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  return (
    <div className="viewport">
      <div
        className={battleActive ? 'stage stage-hud-hidden' : 'stage'}
        style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT, transform: `scale(${scale})` }}
      >
        <ScreenShake>
          {!battleActive && <Hud />}
          <CurrentScreen />
          <LangToggle />
          <MuteToggle />
          <HintButton />
          <Ticker />
        </ScreenShake>
      </div>
    </div>
  );
}
