import { useState } from 'react';
import { LANDMARKS, type LandmarkDef } from '@/data/landmarks';
import type { LandmarkId } from '@/engine/types';
import { useGameStore } from '@/store/gameStore';
import { playSfx } from '../audio/sfx';
import { useT } from '../useT';

/**
 * Target-selection screen for `rename_landmark`, shown once the preview is confirmed —
 * in place of the old automatic random pick (real user feedback: "it would be nice to be
 * able to select what you want to rename on the map. We could add labels over the map so
 * that we can see everything being renamed to 'America'" — same ask, and the same fix
 * shape, `declare_war` already got earlier, see `SelectCountryScreen.tsx`'s doc comment).
 * Reuses the World Map's own visual (`.map-world`), but only plots not-yet-renamed
 * landmarks — `MapScreen.tsx` is where the already-renamed ones show up afterward.
 *
 * Markers are plain dots, not always-visible name labels: all 7 landmarks cluster tightly
 * in one corner of the map (`data/landmarks.ts`'s `mapX`/`mapY`), and the original
 * always-on name pills physically overlapped there, illegibly, in practice (real user
 * screenshot + feedback: "Maybe we can use dots of the map and when you click on it, you
 * show the name"). So picking is two clicks, not one: the first click on a marker reveals
 * its name in a small callout (`activeId`, below) without committing to anything; a
 * second click on that same marker — now visibly the "revealed" one — confirms the pick.
 * Clicking a different marker just moves which one is revealed. This also fixes a latent
 * misclick risk the old dense, overlapping buttons had: you now always see the name
 * before it's locked in, rather than clicking blind into a pile of overlapping labels.
 */
export function SelectLandmarkScreen() {
  const t = useT();
  const game = useGameStore((s) => s.game);
  const selectLandmark = useGameStore((s) => s.selectLandmark);
  const cancelResolution = useGameStore((s) => s.cancelResolution);
  const [activeId, setActiveId] = useState<LandmarkId | null>(null);

  const eligible = LANDMARKS.filter((l) => !game.renamedLandmarks.includes(l.id));

  function handleMarkerClick(landmark: LandmarkDef) {
    if (activeId === landmark.id) {
      playSfx('confirm');
      selectLandmark(landmark.id);
      return;
    }
    playSfx('blip');
    setActiveId(landmark.id);
  }

  return (
    // Same `.menu-overlay` (not `.resolution-overlay`) as SelectCountryScreen, for the
    // same reason: `.map-world` needs the overlay's full width, not the centered layout
    // `.resolution-overlay` gives the other resolution phases.
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
      <h2 className="menu-overlay-title">{t('landmark.selectTitle')}</h2>
      <p className="preview-note">{t('landmark.selectNote')}</p>
      <div className="map-world">
        {eligible.map((landmark) => {
          const isActive = activeId === landmark.id;
          return (
            <button
              key={landmark.id}
              type="button"
              className={`map-landmark-marker${isActive ? ' is-active' : ''}`}
              style={{ left: `${landmark.mapX}%`, top: `${landmark.mapY}%` }}
              title={t(landmark.nameKey)}
              aria-label={t(landmark.nameKey)}
              onClick={() => handleMarkerClick(landmark)}
            >
              {isActive && (
                <span className="map-landmark-callout" aria-hidden="true">
                  {t(landmark.nameKey)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
