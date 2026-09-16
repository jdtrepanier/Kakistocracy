import { CHARACTERS, displayName, shortName } from '@/data/characters';
import type { DifficultyId } from '@/data/balance';
import { useGameStore } from '@/store/gameStore';
import { playSfx } from '../audio/sfx';
import { useT } from '../useT';

/** Every difficulty, in the order shown on the title screen (easiest to hardest). */
const DIFFICULTIES: readonly DifficultyId[] = ['intern', 'normal', 'thirdTerm'];

const DIFFICULTY_NAME_KEY = {
  intern: 'difficulty.intern.name',
  normal: 'difficulty.normal.name',
  thirdTerm: 'difficulty.thirdTerm.name',
} as const;

/** Title screen: the cabinet shown in their pixel-art sprites (`data/characters.ts`), each
 * name tag tinted with that official's `placeholder.color` — a small nod to their old
 * placeholder-square identity now that real art has replaced the squares themselves.
 * Also a difficulty selector (GAME_PLAN roadmap's Intern/Normal/Third Term): it only
 * takes effect on the *next* new run, per `setDifficulty`'s doc comment on the store, so
 * it's shown regardless of whether Continue is available — it just won't change a save
 * already in progress.
 */
export function TitleScreen() {
  const t = useT();
  const continueGame = useGameStore((s) => s.continueGame);
  const newGame = useGameStore((s) => s.newGame);
  const hasSave = useGameStore((s) => s.hasSave);
  const difficulty = useGameStore((s) => s.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);

  return (
    <main className="title-screen">
      <h1 className="title">{t('game.title')}</h1>
      <p className="subtitle">{t('game.subtitle')}</p>

      <ul className="roster" aria-label={t('game.cabinet')}>
        {CHARACTERS.map((c) => (
          <li key={c.id} className="roster-member" title={displayName(c.id)}>
            <span className="roster-portrait">
              <img className="placeholder-sprite" src={c.sprite.front} alt="" />
            </span>
            <span className="roster-name" style={{ background: c.placeholder.color }}>
              {shortName(c.id)}
            </span>
          </li>
        ))}
      </ul>

      <div className="difficulty-picker" role="radiogroup" aria-label={t('difficulty.label')}>
        {DIFFICULTIES.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={difficulty === id}
            className={
              difficulty === id
                ? 'pixel-button difficulty-button difficulty-button-selected'
                : 'pixel-button difficulty-button'
            }
            onClick={() => {
              if (difficulty === id) return;
              playSfx('blip');
              setDifficulty(id);
            }}
          >
            {t(DIFFICULTY_NAME_KEY[id])}
          </button>
        ))}
      </div>

      {hasSave ? (
        <div className="title-actions">
          <button
            type="button"
            className="pixel-button press-start"
            onClick={() => {
              playSfx('confirm');
              continueGame();
            }}
          >
            {t('game.continue')}
          </button>
          <button
            type="button"
            className="pixel-button title-new-game"
            onClick={() => {
              playSfx('blip');
              newGame();
            }}
          >
            {t('screen.newGame')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="pixel-button press-start"
          onClick={() => {
            playSfx('confirm');
            // Not `startGame()`: the game state was created before the difficulty
            // picker above could have been touched, so a fresh run has to be built now
            // to pick up whatever difficulty is currently selected.
            newGame();
          }}
        >
          {t('game.pressStart')}
        </button>
      )}
      <p className="build-info">{t('game.buildInfo')}</p>
    </main>
  );
}
