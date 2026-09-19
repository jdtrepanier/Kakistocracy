import { useState } from 'react';
import { COUNTRIES } from '@/data/countries';
import type { CountryDef } from '@/data/countries';
import { LANDMARKS } from '@/data/landmarks';
import type { LandmarkId } from '@/engine/types';
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
 * The World Map menu (GAME_PLAN §10): a status board, not a target picker. Declare War,
 * Buy a Country and Rename a Landmark each pick their own target on a dedicated screen
 * first (`SelectCountryScreen.tsx`/`SelectLandmarkScreen.tsx`) — this is where you see
 * which ones got hit, including a persistent "(now America)" tag on an owned country
 * and a marker for every landmark renamed so far (real user feedback: "we could add
 * labels over the map so that we can see everything being renamed to 'America'" — an
 * owned country gets the same tag, not just landmarks, since buying a country is the
 * same "made it ours" joke one level up).
 *
 * Renamed landmarks are dots, not always-visible name labels, same as
 * `SelectLandmarkScreen.tsx`'s picker (see that file's doc comment) and for the exact
 * same reason: all 7 landmarks cluster tightly in one corner of the map, and this board
 * only shows the *renamed* subset, which grows over a run — the old always-on pills were
 * already overlapping with just a handful renamed (real user screenshot). Clicking a
 * marker here just toggles its name callout open/closed — there's nothing to confirm,
 * it's already renamed.
 */
export function MapScreen() {
  const t = useT();
  const game = useGameStore((s) => s.game);
  const closeOverlay = useGameStore((s) => s.closeOverlay);
  const renamedLandmarks = LANDMARKS.filter((l) => game.renamedLandmarks.includes(l.id));
  const [activeLandmarkId, setActiveLandmarkId] = useState<LandmarkId | null>(null);

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
              {status === 'owned' && <span className="map-now-america">{t('map.nowAmerica')}</span>}
            </span>
          );
        })}
        {renamedLandmarks.map((landmark) => {
          // Every marker rendered here is already renamed, so it's always gold
          // (`is-active`, same "claimed" gold as an owned country's dot) — `calloutOpen`
          // is a separate, purely visual toggle for whether its name callout is showing.
          const calloutOpen = activeLandmarkId === landmark.id;
          return (
            <button
              key={landmark.id}
              type="button"
              className="map-landmark-marker is-active"
              style={{ left: `${landmark.mapX}%`, top: `${landmark.mapY}%` }}
              title={t(landmark.renamedKey)}
              aria-label={t(landmark.renamedKey)}
              onClick={() =>
                setActiveLandmarkId((current) => (current === landmark.id ? null : landmark.id))
              }
            >
              {calloutOpen && (
                <span className="map-landmark-callout" aria-hidden="true">
                  {t(landmark.renamedKey)}
                </span>
              )}
            </button>
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
        <span className="map-legend-item">
          <span className="map-landmark-dot" aria-hidden="true" /> {t('landmark.renamedBadge')}
        </span>
      </div>
    </div>
  );
}
