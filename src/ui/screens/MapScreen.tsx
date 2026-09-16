import { COUNTRIES } from '@/data/countries';
import type { CountryDef } from '@/data/countries';
import { useGameStore } from '@/store/gameStore';
import { useT } from '../useT';

function countryStatus(
  country: CountryDef,
  atWarWith: readonly string[],
  countriesOwned: readonly string[],
): 'war' | 'owned' | 'neutral' {
  if (atWarWith.includes(country.id)) return 'war';
  if (countriesOwned.includes(country.id)) return 'owned';
  return 'neutral';
}

/**
 * The World Map menu (GAME_PLAN §10): a status board, not a target picker. Declare War
 * and Buy a Country each pick a random eligible country when they resolve; this is where
 * you see which ones got hit.
 */
export function MapScreen() {
  const t = useT();
  const game = useGameStore((s) => s.game);
  const closeOverlay = useGameStore((s) => s.closeOverlay);

  return (
    <div className="menu-overlay">
      <button type="button" className="pixel-button menu-overlay-close" onClick={closeOverlay}>
        {t('screen.close')}
      </button>
      <h2 className="menu-overlay-title">{t('map.title')}</h2>
      <div className="map-world">
        {COUNTRIES.map((country) => {
          const status = countryStatus(country, game.atWarWith, game.countriesOwned);
          return (
            <span
              key={country.id}
              className={`map-country is-${status}`}
              style={{ left: `${country.mapX}%`, top: `${country.mapY}%` }}
            >
              <span className="map-country-dot" aria-hidden="true" />
              {t(country.nameKey)}
            </span>
          );
        })}
      </div>
      <div className="map-legend">
        <span className="map-legend-item">
          <span className="map-country-dot" aria-hidden="true" /> {t('map.status.neutral')}
        </span>
        <span className="map-legend-item">
          <span className="map-country-dot is-war-dot" aria-hidden="true" /> {t('map.status.war')}
        </span>
        <span className="map-legend-item">
          <span className="map-country-dot is-owned-dot" aria-hidden="true" />{' '}
          {t('map.status.owned')}
        </span>
      </div>
    </div>
  );
}
