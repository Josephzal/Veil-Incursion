/**
 * Phase 3M — presentation settings (presentation-only; never affects combat math).
 */

import {
  DEFAULT_COMBAT_PRESENTATION_SETTINGS,
  type CombatPresentationSettings,
} from '../../types/weaponCombatPresentation';

let settings: CombatPresentationSettings = { ...DEFAULT_COMBAT_PRESENTATION_SETTINGS };
const listeners = new Set<(next: CombatPresentationSettings) => void>();

export function getCombatPresentationSettings(): CombatPresentationSettings {
  return { ...settings };
}

export function patchCombatPresentationSettings(
  patch: Partial<CombatPresentationSettings>,
): CombatPresentationSettings {
  settings = {
    ...settings,
    ...patch,
    sfxVolume: Math.max(0, Math.min(1, patch.sfxVolume ?? settings.sfxVolume)),
    combatSpeed: Math.max(0.5, Math.min(3, patch.combatSpeed ?? settings.combatSpeed)),
  };
  listeners.forEach((fn) => fn(getCombatPresentationSettings()));
  return getCombatPresentationSettings();
}

export function resetCombatPresentationSettings(): CombatPresentationSettings {
  settings = { ...DEFAULT_COMBAT_PRESENTATION_SETTINGS };
  listeners.forEach((fn) => fn(getCombatPresentationSettings()));
  return getCombatPresentationSettings();
}

export function subscribeCombatPresentationSettings(
  listener: (next: CombatPresentationSettings) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Compress authored ms by combat speed (presentation only). */
export function scalePresentationMs(ms: number, speed = settings.combatSpeed): number {
  return Math.max(1, Math.round(ms / Math.max(0.5, speed)));
}
