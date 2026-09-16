import type { MessageKey } from '@/i18n/en';
import type { CharacterId, Effect, GameState } from './types';

/**
 * Where an action is available (GAME_PLAN §10). Phase 1 has no rooms UI yet — this is
 * shown as a small tag next to the action so the eventual room layout has somewhere to
 * plug in.
 */
export type RoomId =
  | 'ovalOffice'
  | 'situationRoom'
  | 'treasury'
  | 'federalReserve'
  | 'commerce'
  | 'pentagon'
  | 'mapRoom'
  | 'starbase'
  | 'nationalMall'
  | 'roseGarden'
  | 'capitol'
  | 'marALago';

export type ActionLimit = 'oncePerMonth' | 'oncePerRun';

export interface ActionRequirements {
  /** Only available at or below this Party IQ. */
  readonly iqMax?: number;
  /** Only available once every one of these flags is set (GAME_PLAN §15's `ActionDef`
   * sketch names this; Phase 1–4 never needed it until Elon's reconciliation and Golden
   * Dome's follow-ups required gating an action on cabinet state, not just IQ). */
  readonly flags?: readonly string[];
  /** Only available while none of these flags are set — the mirror of `flags` above,
   * e.g. keeping Elon's own actions off the table while `elonLeftCabinet` is set. */
  readonly notFlags?: readonly string[];
}

export interface ActionDef {
  readonly id: string;
  /** i18n key for the button label, e.g. 'action.declareWar.name'. */
  readonly nameKey: MessageKey;
  /** `'any'` means any official can do it (e.g. reading a briefing). */
  readonly actors: readonly CharacterId[] | 'any';
  readonly room: RoomId;
  readonly cost: { readonly ea: number };
  readonly limit?: ActionLimit;
  readonly requires?: ActionRequirements;
  /**
   * Success chance before modifiers, 0–100. Phase 1 has no specialty, room or IQ
   * modifiers yet (those arrive with character selection in Phase 2/3, per §7) — this
   * base value is the chance shown and rolled as-is.
   */
  readonly baseSuccess: number;
  readonly onSuccess: readonly Effect[];
  readonly onFail: readonly Effect[];
  /** Base Headlines on success; diminishing returns and the fail ratio scale this down. */
  readonly headlines: number;
}

export type UnavailableReason = 'ended' | 'iq' | 'ea' | 'limit' | 'wrongOfficial' | 'flags';

export type Availability =
  { readonly ok: true } | { readonly ok: false; readonly reason: UnavailableReason };

/**
 * Whether `action` can be performed right now, and if not, why (for the UI to explain).
 *
 * `activeCharacter`, when given, also enforces GAME_PLAN §8's "each official has
 * signature actions only they can do" — an action whose `actors` doesn't include the
 * active official is unavailable. It's optional because `resolve.ts`'s own
 * `checkAvailability` call is a last-line sanity check that runs after the UI has
 * already enforced this at the moment the action was started (and doesn't have — or
 * need — a second officer to re-check against).
 */
export function checkAvailability(
  action: ActionDef,
  state: GameState,
  activeCharacter?: CharacterId,
): Availability {
  if (state.ending) return { ok: false, reason: 'ended' };
  if (activeCharacter && action.actors !== 'any' && !action.actors.includes(activeCharacter)) {
    return { ok: false, reason: 'wrongOfficial' };
  }
  if (action.requires?.iqMax !== undefined && state.stats.iq > action.requires.iqMax) {
    return { ok: false, reason: 'iq' };
  }
  if (action.requires?.flags?.some((f) => !state.flags.includes(f))) {
    return { ok: false, reason: 'flags' };
  }
  if (action.requires?.notFlags?.some((f) => state.flags.includes(f))) {
    return { ok: false, reason: 'flags' };
  }
  if (state.actionsLeft < action.cost.ea) return { ok: false, reason: 'ea' };
  if (action.limit === 'oncePerMonth' && state.actionsUsedThisMonth.includes(action.id)) {
    return { ok: false, reason: 'limit' };
  }
  if (action.limit === 'oncePerRun' && state.history.some((h) => h.actionId === action.id)) {
    return { ok: false, reason: 'limit' };
  }
  return { ok: true };
}
