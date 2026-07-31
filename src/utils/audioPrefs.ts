/**
 * User-facing audio mix (hub settings).
 * Fans out to BGM user mix, combat presentation sfxVolume, and UI feedback scale.
 */

import { setBgmUserMix } from './bgmController';
import { setUiFeedbackVolumeScale } from './uiFeedbackAudio';
import { patchCombatPresentationSettings } from '../data/weaponCombatPresentation/presentationSettings';
import { DEFAULT_COMBAT_PRESENTATION_SETTINGS } from '../types/weaponCombatPresentation';

export interface AudioPrefs {
  /** Scales music + SFX. */
  master: number;
  /** Scales BGM beds only (× master). */
  music: number;
  /** Scales combat + UI SFX (× master). */
  sfx: number;
}

export const DEFAULT_AUDIO_PREFS: AudioPrefs = {
  master: 1,
  music: 1,
  sfx: 1,
};

const COMBAT_SFX_BASE = DEFAULT_COMBAT_PRESENTATION_SETTINGS.sfxVolume;

let prefs: AudioPrefs = { ...DEFAULT_AUDIO_PREFS };
const listeners = new Set<(next: AudioPrefs) => void>();

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function applyAudioPrefs(): void {
  setBgmUserMix({ music: prefs.music, master: prefs.master });
  const sfxOut = clamp01(COMBAT_SFX_BASE * prefs.sfx * prefs.master);
  patchCombatPresentationSettings({
    sfxVolume: sfxOut,
    sfxMuted: sfxOut <= 0.001,
  });
  setUiFeedbackVolumeScale(clamp01(prefs.sfx * prefs.master));
}

function notify(): void {
  const snapshot = getAudioPrefs();
  listeners.forEach((fn) => fn(snapshot));
}

export function getAudioPrefs(): AudioPrefs {
  return { ...prefs };
}

export function patchAudioPrefs(partial: Partial<AudioPrefs>): AudioPrefs {
  prefs = {
    master: clamp01(partial.master ?? prefs.master),
    music: clamp01(partial.music ?? prefs.music),
    sfx: clamp01(partial.sfx ?? prefs.sfx),
  };
  applyAudioPrefs();
  notify();
  return getAudioPrefs();
}

export function resetAudioPrefs(): AudioPrefs {
  prefs = { ...DEFAULT_AUDIO_PREFS };
  applyAudioPrefs();
  notify();
  return getAudioPrefs();
}

export function subscribeAudioPrefs(listener: (next: AudioPrefs) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Nudge one channel by a fixed step (default 10%). */
export function nudgeAudioPref(
  key: keyof AudioPrefs,
  delta: number,
): AudioPrefs {
  return patchAudioPrefs({ [key]: clamp01(prefs[key] + delta) });
}

// Apply defaults once so subsystems stay in sync if prefs change later.
applyAudioPrefs();
