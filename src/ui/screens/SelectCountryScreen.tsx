import { COUNTRIES } from '@/data/countries';
import { useGameStore } from '@/store/gameStore';
import { playSfx } from '../audio/sfx';
import { useT } from '../useT';

/**
 * Target-selection screen for a battle-gated action (GAME_PLAN §7.1), shown once the
 * preview is confirmed — in place of the old automatic random pick (real user feedback:
 * "you should be able to select your country to attack"). Reuses the World Map's own
 * visual (`.map-world`/`.map-country`, see `MapScreen.tsx`), but only plots countries
 * actually eligible to fight right now (war targets not already at war), each a real
 * button instead of a static status marker.
 */
export function SelectCountryScreen() {
  const t = useT();
  const game = useGameStore((s) => s.game);
  const selectBattleCountry = useGameStore((s) => s.selectBattleCountry);
  const cancelResolution = useGameStore((s) => s.cancelResolution);

  const eligible = COUNTRIES.filter((c) => c.warTarget && !game.atWarWith.includes(c.id));

  return (
    // Plain `.menu-overlay`, not `.resolution-overlay` (used by the other resolution
    // phases): that modifier centers content for short text dialogs via `align-items:
    // center`, which would stop `.map-world` from stretching to the overlay's full width.
    // `MapScreen.tsx`'s World Map menu has the identical box for the identical reason.
    <div className="menu-overlay" role="dialog" aria-modal="true">
      <button
        type="button"
        className="pixel-button menu-overlay-close"
        onClick={() => {
          playSfx('cancel');
          cancelResolution();
        }}
      >
        {t('resolution.cancel')}
      </button>
      <h2 className="menu-overlay-title">{t('battle.selectCountryTitle')}</h2>
      <p className="preview-note">{t('battle.selectCountryNote')}</p>
      <div className="map-world">
        {eligible.map((country) => (
          <button
            key={country.id}
            type="button"
            className="map-country map-country-button"
            style={{ left: `${country.mapX}%`, top: `${country.mapY}%` }}
            onClick={() => {
              playSfx('confirm');
              selectBattleCountry(country.id);
            }}
          >
            <span className="map-country-dot is-war-dot" aria-hidden="true" />
            {t(country.nameKey)}
          </button>
        ))}
      </div>
    </div>
  );
}
