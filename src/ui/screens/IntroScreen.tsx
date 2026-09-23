import { useEffect, useState } from 'react';
import { displayName, getCharacter } from '@/data/characters';
import type { MessageKey } from '@/i18n/en';
import { useGameStore } from '@/store/gameStore';
import { playSfx } from '../audio/sfx';
import { BattleView } from '../battle/BattleView';
import { useT } from '../useT';

type Speaker = 'trump' | 'vance' | 'narrator';

interface IntroBeat {
  readonly speaker: Speaker;
  readonly textKey: MessageKey;
}

/**
 * The user's own 8-beat script, split into one dialogue-box "beat" per line (plus two
 * narration/reaction beats for the can dropping and Trump picking it up — beats 6/7 of
 * the original script folded into this same click-through flow rather than a separate
 * bespoke UI, so every line of the cutscene shares one consistent presentation). Beat 8
 * ("the game begins with an attack against Canada") isn't a line at all — it's the
 * zoom-on-the-can/Carney-reveal beat below, then the battle itself.
 */
const BEATS: readonly IntroBeat[] = [
  { speaker: 'trump', textKey: 'intro.line1' },
  { speaker: 'vance', textKey: 'intro.line2' },
  { speaker: 'trump', textKey: 'intro.line3' },
  { speaker: 'vance', textKey: 'intro.line4' },
  { speaker: 'trump', textKey: 'intro.line5' },
  { speaker: 'narrator', textKey: 'intro.canFalls' },
  { speaker: 'trump', textKey: 'intro.pickUp' },
];

/** The beat index at which the can (script beat 6) is on screen — shown from here
 * through the end of the dialogue beats, then handed off to the big "zoom" render. */
const CAN_VISIBLE_FROM_BEAT = 5;

/** How long Trump's walk-toward-Vance animation takes (must match `intro.css`'s
 * `intro-trump-walk-in` keyframe duration by hand — same "CSS can't reference a JS
 * constant" reasoning `ROOM_MOVE_TRANSITION_MS` already has elsewhere in this project).
 * Once it elapses, Trump's sprite swaps from a walking (`right`-facing) pose to his
 * normal `front` one for the rest of the scene. */
const TRUMP_WALK_MS = 1100;

/** How long the camera lingers on the close-up can (script beat 7's "after a few
 * seconds") before Carney's face pops up in a speech bubble. */
const CARNEY_REVEAL_DELAY_MS = 1800;

/**
 * The opening cutscene (GAME_PLAN: plays once at the start of every new game, skippable
 * — see the two `AskUserQuestion` answers this feature was scoped from). Three beats,
 * click/Enter-to-advance throughout:
 *   1. `'dialogue'` — the 7 `BEATS` above, Trump walking in first.
 *   2. `'zoomCan'` — a close-up on the can, then Carney's face in a speech bubble.
 *   3. The battle itself, once "Attack Canada" is clicked — rendered by reusing
 *      `BattleView` with its own parallel `introBattle` state (`store/gameStore.ts`),
 *      never `resolution`, so this fight can never apply a real stat effect.
 * The Skip button (and Enter/Space's own guard against double-firing on a focused
 * button, see `handleWindowKeyDown` below) is available through every beat except the
 * post-battle result banner, where "Begin the Term" is the only way out — by then
 * there's nothing left to skip.
 */
export function IntroScreen() {
  const t = useT();
  const introBattle = useGameStore((s) => s.introBattle);
  const introStartBattle = useGameStore((s) => s.introStartBattle);
  const introBattleMove = useGameStore((s) => s.introBattleMove);
  const introBattleAttack = useGameStore((s) => s.introBattleAttack);
  const introBattleEndTurn = useGameStore((s) => s.introBattleEndTurn);
  const introBattleRunEnemyTurn = useGameStore((s) => s.introBattleRunEnemyTurn);
  const finishIntro = useGameStore((s) => s.finishIntro);
  const grabItem = useGameStore((s) => s.grabItem);

  const [phase, setPhase] = useState<'dialogue' | 'zoomCan'>('dialogue');
  const [lineIndex, setLineIndex] = useState(0);
  const [trumpArrived, setTrumpArrived] = useState(false);
  const [carneyRevealed, setCarneyRevealed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTrumpArrived(true), TRUMP_WALK_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== 'zoomCan') return;
    const timer = setTimeout(() => setCarneyRevealed(true), CARNEY_REVEAL_DELAY_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // Real user feedback: "the can of meat should stay in your items" — this cutscene's
  // can was purely narrative until now; grab it into the real inventory the moment its
  // own beat starts. `grabItem` is idempotent (`store/gameStore.ts`), so re-entering
  // this effect (a re-render, or — in principle — replaying the cutscene) never
  // duplicates the entry.
  useEffect(() => {
    if (phase === 'zoomCan') grabItem('can-of-meat');
  }, [phase, grabItem]);

  const advanceLine = () => {
    playSfx('blip');
    setLineIndex((i) => {
      if (i + 1 >= BEATS.length) {
        setPhase('zoomCan');
        return i;
      }
      return i + 1;
    });
  };

  // Enter/Space advances the dialogue from anywhere — except when a real <button>
  // (Skip, in this phase) already has focus, where letting both the button's own native
  // activation *and* this handler fire off the same keydown would double-fire (skip the
  // whole cutscene *and* advance a line that's about to be unmounted anyway).
  useEffect(() => {
    if (phase !== 'dialogue') return;
    const handler = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.tagName === 'BUTTON') return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        advanceLine();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // `advanceLine` reads/writes `lineIndex` through a functional `setLineIndex` update,
    // so it never closes over a stale value — only `phase` needs to be a real dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const handleSkip = () => {
    playSfx('cancel');
    finishIntro();
  };

  const handleAttack = () => {
    playSfx('confirm');
    introStartBattle();
  };

  const handleBeginTerm = () => {
    playSfx('confirm');
    finishIntro();
  };

  // The battle beat — once started, this screen renders the shared `BattleView` with
  // its own parallel battle state (never `resolution.battle`, see `IntroBattleState`'s
  // doc comment on why: this fight must never reach `resolveBattleAction`).
  if (introBattle) {
    if (introBattle.outcome) {
      return (
        <div className="intro-screen intro-result" role="dialog" aria-modal="true">
          <p className="intro-result-text">
            {t(introBattle.outcome === 'usWin' ? 'intro.battleWin' : 'intro.battleLose')}
          </p>
          <button type="button" className="pixel-button" onClick={handleBeginTerm}>
            {t('intro.beginTerm')}
          </button>
        </div>
      );
    }
    return (
      <div className="intro-screen intro-battle-wrap">
        <BattleView
          battle={introBattle.battle}
          battleCountry="canada"
          onMove={introBattleMove}
          onAttack={introBattleAttack}
          onEndTurn={introBattleEndTurn}
          onRunEnemyTurn={introBattleRunEnemyTurn}
        />
        <button
          type="button"
          className="pixel-button intro-skip-button"
          onClick={handleSkip}
          aria-label={t('intro.skip.label')}
        >
          {t('intro.skip')}
        </button>
      </div>
    );
  }

  if (phase === 'zoomCan') {
    const skipButton = (
      <button
        type="button"
        className="pixel-button intro-skip-button"
        onClick={handleSkip}
        aria-label={t('intro.skip.label')}
      >
        {t('intro.skip')}
      </button>
    );

    // Two sub-beats, swapped rather than stacked. The original build showed the zoomed
    // can, then *added* a Carney speech-bubble card underneath it once revealed, then
    // *added* the Attack button below that — three beats' worth of content stacked at
    // once, which is what overflowed this screen's ~230px content height (270 stage px
    // minus the HUD/ticker insets) and clipped the button under the ticker (real user
    // report, with a screenshot). Swapping the can-zoom out for the think-bubble scene
    // once Carney's revealed, instead of piling it on top, keeps each sub-beat well
    // under budget on its own.
    if (!carneyRevealed) {
      return (
        <div className="intro-screen intro-zoom" role="dialog" aria-modal="true">
          {skipButton}
          <div className="intro-zoom-stage">
            <img
              className="intro-zoom-can"
              src="/assets/cutscene/can-of-meat-closeup.png"
              alt={t('intro.itemObtained')}
            />
            <p className="intro-zoom-caption">{t('intro.zoomCaption')}</p>
          </div>
        </div>
      );
    }

    // Real user feedback, round 2: "Move the meat can to the right and then make Trump
    // appear with the bubble to the left without the 'Sorry, did someone say my name?'"
    // — the can no longer disappears once Carney's revealed, it just moves aside (to the
    // right) to make room for Trump (left) and his thought-bubble; and the old caption
    // line under the bubble (Carney's own line, `intro.carneyBubble`) is gone outright —
    // the thought-bubble's portrait alone carries the beat, no text underneath it at all.
    // Round 3: "Carney should face the can and put them closer together" —
    // `.intro-think-trump`/`.intro-think-cloud`/`.intro-think-can` were pulled in closer
    // together in `intro.css` per that feedback.
    // Round 4: "You can put this picture in the bubble. Crop it with CSS so it fits in
    // the bubble" — replaced his pixel-art battle-roster sprite in the cloud with a real
    // supplied photo (`public/assets/cutscene/carney-portrait.png`), cropped to the
    // cloud's own circle via CSS (`.intro-carney-portrait`'s `object-fit: cover` inside
    // `.intro-think-cloud`'s `overflow: hidden`/`border-radius: 50%`) rather than a
    // pre-cropped image file.
    const trump = getCharacter('trump');
    return (
      <div className="intro-screen intro-think" role="dialog" aria-modal="true">
        {skipButton}
        <div className="intro-think-stage">
          <img className="intro-think-trump" src={trump.sprite.front} alt="" aria-hidden="true" />
          <div className="intro-think-bubble" aria-hidden="true">
            <div className="intro-think-cloud">
              {/* A real photo, not the pixel-art battle sprite (user request: "You can put
               * this picture in the bubble. Crop it with CSS so it fits in the bubble.") —
               * `.intro-think-cloud` already clips to a circle (`overflow: hidden` +
               * `border-radius: 50%`), so a full-bleed `object-fit: cover` image gets
               * cropped into that same circle for free; `.intro-carney-portrait`'s own
               * `object-position` picks the crop to favor his face over his shoulders. */}
              <img
                className="intro-carney-portrait"
                src="/assets/cutscene/carney-portrait.png"
                alt=""
              />
            </div>
            <span className="intro-think-dot intro-think-dot-1" />
            <span className="intro-think-dot intro-think-dot-2" />
          </div>
          <img
            className="intro-think-can"
            src="/assets/cutscene/can-of-meat-closeup.png"
            alt={t('intro.itemObtained')}
          />
        </div>
        <button type="button" className="pixel-button intro-attack-button" onClick={handleAttack}>
          {t('intro.beginBattle')}
        </button>
      </div>
    );
  }

  const beat = BEATS[lineIndex];
  if (!beat) return null;
  const trump = getCharacter('trump');
  const vance = getCharacter('vance');
  const speakerLabel =
    beat.speaker === 'trump'
      ? displayName('trump')
      : beat.speaker === 'vance'
        ? displayName('vance')
        : null;

  return (
    <div className="intro-screen intro-dialogue-scene" role="dialog" aria-modal="true">
      <button
        type="button"
        className="pixel-button intro-skip-button"
        onClick={handleSkip}
        aria-label={t('intro.skip.label')}
      >
        {t('intro.skip')}
      </button>
      <div className="intro-stage">
        {/* Both actors face each other throughout, not the camera. `CharacterSprite`'s
         * `left`/`right` poses are named for the isometric room-camera direction they were
         * cropped for (see `data/characters.ts`'s own doc comment: `left` is actually a
         * back-left diagonal, `right` a front-right one), not for which way the character
         * visually faces in a flat scene like this one — so "face right" here is
         * `sprite.right` (front-on, turned right) and "face left" is `sprite.front`
         * (front-on, turned left), never `sprite.left` (which renders as the back of the
         * head — confirmed against the actual PNGs, this was the original bug). Trump
         * stays on `right` the whole beat (he's walking in from the left toward Vance, and
         * stays turned toward him once arrived — only his position animates, not his
         * pose), and Vance stays on `front` (turned left, toward Trump). */}
        <img
          className={
            trumpArrived
              ? 'intro-actor intro-actor-trump'
              : 'intro-actor intro-actor-trump is-walking'
          }
          src={trump.sprite.right}
          alt=""
          aria-hidden="true"
        />
        <img
          className="intro-actor intro-actor-vance"
          src={vance.sprite.front}
          alt=""
          aria-hidden="true"
        />
        {lineIndex >= CAN_VISIBLE_FROM_BEAT && (
          <img
            className="intro-can-drop"
            src="/assets/items/can-of-meat.png"
            alt=""
            aria-hidden="true"
          />
        )}
      </div>
      <div
        className="intro-dialogue-box"
        role="button"
        tabIndex={0}
        onClick={advanceLine}
        aria-label={t('intro.continuePrompt')}
      >
        {speakerLabel && <span className="intro-dialogue-speaker">{speakerLabel}</span>}
        <p className={speakerLabel ? 'intro-dialogue-text' : 'intro-dialogue-text is-narration'}>
          {t(beat.textKey)}
        </p>
        <span className="intro-dialogue-continue" aria-hidden="true">
          ▼
        </span>
      </div>
    </div>
  );
}
