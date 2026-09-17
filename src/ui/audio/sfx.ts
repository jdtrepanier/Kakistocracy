/**
 * Placeholder chiptune audio (GAME_PLAN §16 "Audio"): short blips, jingles and an ambient
 * hum, synthesized on the fly with the Web Audio API — no audio files, no new dependency.
 * GAME_PLAN §15 names Howler.js as the eventual real audio library; this module stands in
 * for it until real chiptune assets exist, same spirit as the placeholder coloured-square
 * sprites (`data/characters.ts`'s `placeholder` field) stand in for real art.
 *
 * `playBattleMusic`/`stopBattleMusic` are the one exception — a real, user-supplied audio
 * file (`public/assets/audio/battle01.mp3`), played back with a plain `HTMLAudioElement`
 * rather than synthesized, since a 3-minute loop is well past what's reasonable to
 * generate with oscillators. It's otherwise a first-class citizen of this module: same
 * `muted` flag, same "never worth crashing the game over a sound" posture.
 *
 * Lives under `ui/` (not `engine/` or `data/`, per `CLAUDE.md`'s architecture rules —
 * `AudioContext` is a browser API, same reasoning that keeps `localStorage` out of those
 * layers). The context is created lazily, on first actual playback, rather than at
 * module load: browsers refuse to run an `AudioContext` before a user gesture anyway, and
 * by the time anything here is called (a button click, a resolved action) one has always
 * already happened.
 */

export type SfxId = 'blip' | 'confirm' | 'cancel' | 'success' | 'fail' | 'headline';

interface Note {
  readonly freq: number;
  /** Seconds after the sound starts. */
  readonly at: number;
  /** Seconds this note rings for. */
  readonly dur: number;
  readonly type?: OscillatorType;
}

/** Short note sequences for each sound, tuned to be heard, not enjoyed — this is a
 * placeholder, not a composition. */
const JINGLES: Readonly<Record<SfxId, readonly Note[]>> = {
  blip: [{ freq: 660, at: 0, dur: 0.045 }],
  confirm: [
    { freq: 440, at: 0, dur: 0.05 },
    { freq: 660, at: 0.05, dur: 0.09 },
  ],
  cancel: [
    { freq: 330, at: 0, dur: 0.05 },
    { freq: 220, at: 0.05, dur: 0.07 },
  ],
  success: [
    { freq: 523.25, at: 0, dur: 0.09 },
    { freq: 659.25, at: 0.09, dur: 0.09 },
    { freq: 783.99, at: 0.18, dur: 0.2 },
  ],
  fail: [
    { freq: 311.13, at: 0, dur: 0.12, type: 'sawtooth' },
    { freq: 220, at: 0.11, dur: 0.24, type: 'sawtooth' },
  ],
  headline: [
    { freq: 392, at: 0, dur: 0.06 },
    { freq: 523.25, at: 0.06, dur: 0.06 },
    { freq: 659.25, at: 0.12, dur: 0.16 },
  ],
};

let ctx: AudioContext | null = null;
let muted = false;
let ambient: { readonly oscillators: readonly OscillatorNode[]; readonly gain: GainNode } | null =
  null;
let battleMusic: HTMLAudioElement | null = null;

/** Creates (once) and resumes the shared `AudioContext`, or returns `null` in an
 * environment with no Web Audio (SSR, an ancient browser, a test runner). */
function getContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof window.AudioContext === 'undefined') return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function playTone(context: AudioContext, note: Note, startTime: number): void {
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = note.type ?? 'square';
  osc.frequency.setValueAtTime(note.freq, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.06, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + note.dur);
  osc.connect(gain).connect(context.destination);
  osc.start(startTime);
  osc.stop(startTime + note.dur + 0.02);
}

/** Plays one of the fixed jingles. Silently does nothing when muted or when Web Audio
 * isn't available — never worth crashing the game over a sound effect. */
export function playSfx(id: SfxId): void {
  if (muted) return;
  const context = getContext();
  if (!context) return;
  const startBase = context.currentTime;
  for (const note of JINGLES[id]) {
    playTone(context, note, startBase + note.at);
  }
}

/** Starts the quiet two-note drone under ordinary room play (GAME_PLAN §16's "tense loop"
 * idea, toned down to a constant ambient hum for this placeholder pass — reacting to
 * near-threshold stats is a later refinement). A no-op if already running or muted.
 *
 * Not currently called anywhere: `App.tsx` used to start/stop this automatically on every
 * room-screen mount, but a constant background drone with no way to turn it off short of
 * muting all sound (SFX included) read as "background sound non-stop" in practice — a
 * real piece of user feedback, not a hypothetical. Left here, still fully working, for
 * whenever real ambient music (or a dedicated music toggle, separate from the SFX mute)
 * replaces it, rather than deleted outright. */
export function startAmbientHum(): void {
  if (muted || ambient) return;
  const context = getContext();
  if (!context) return;

  const gain = context.createGain();
  gain.gain.value = 0.012;
  gain.connect(context.destination);

  const root = context.createOscillator();
  root.type = 'sine';
  root.frequency.value = 55; // low A

  const fifth = context.createOscillator();
  fifth.type = 'sine';
  fifth.frequency.value = 55 * 1.5;

  root.connect(gain);
  fifth.connect(gain);
  root.start();
  fifth.start();

  ambient = { oscillators: [root, fifth], gain };
}

/** Fades out and stops the ambient hum, if running. */
export function stopAmbientHum(): void {
  if (!ambient) return;
  const { oscillators, gain } = ambient;
  const context = ctx;
  if (context) {
    gain.gain.setTargetAtTime(0, context.currentTime, 0.15);
    setTimeout(() => oscillators.forEach((osc) => osc.stop()), 400);
  } else {
    oscillators.forEach((osc) => osc.stop());
  }
  ambient = null;
}

/**
 * Starts the looping battle track (`ui/battle/BattleView.tsx` calls this on mount, and
 * `stopBattleMusic` on unmount — so it plays for exactly as long as a battle is on
 * screen). Idempotent: calling it again mid-battle (there's no reason to, but nothing
 * stops a caller) is a no-op rather than restarting the track or stacking a second one.
 *
 * Unlike `playSfx`, this still sets up the `<audio>` element even while muted — just
 * without calling `.play()` — so that unmuting mid-battle (`setMuted`, below) has
 * something to resume rather than nothing happening until the next battle starts.
 */
export function playBattleMusic(): void {
  if (battleMusic) return;
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return;

  const audio = new Audio('/assets/audio/battle01.mp3');
  audio.loop = true;
  audio.volume = 0.5;
  battleMusic = audio;
  if (!muted) {
    // Autoplay can still be refused in a rare edge case even after a prior user
    // gesture; there's nothing to recover, so the player just won't hear it that once —
    // same posture as `playSfx` never throwing over a sound effect.
    void audio.play().catch(() => {});
  }
}

/** Stops and releases the battle track, if one is playing (or paused-while-muted). */
export function stopBattleMusic(): void {
  if (!battleMusic) return;
  battleMusic.pause();
  battleMusic.currentTime = 0;
  battleMusic = null;
}

export function isMuted(): boolean {
  return muted;
}

/** Mutes (or unmutes) every sound this module makes. Muting also stops the ambient hum
 * immediately (rather than leaving it playing until the next `startAmbientHum` call) and
 * pauses the battle track in place; unmuting resumes the battle track from where it left
 * off, if one is currently set up (`playBattleMusic`). */
export function setMuted(next: boolean): void {
  muted = next;
  if (muted) {
    stopAmbientHum();
    battleMusic?.pause();
  } else {
    void battleMusic?.play().catch(() => {});
  }
}
