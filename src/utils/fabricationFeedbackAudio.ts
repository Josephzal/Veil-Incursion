/**
 * Forge fabrication hold SFX — plays while the fabricate button is held.
 * Early release → quick fade-out. Successful craft → play through with end fade.
 */

import { CRAFT_SAMPLE, FABRICATE_DONE_SAMPLE } from './uiFeedbackAudioSamples';
import { getUiFeedbackVolumeScale } from './uiFeedbackAudio';

export type FabricationAudioCue =
  | 'fabrication_accept'
  | 'fabrication_converge'
  | 'fabrication_seal'
  | 'fabrication_complete';

export interface FabricationAudioHooks {
  play: (cue: FabricationAudioCue) => void;
}

type AudioEl = {
  src: string;
  volume: number;
  currentTime: number;
  duration: number;
  muted: boolean;
  paused: boolean;
  preload: string;
  cloneNode: (deep?: boolean) => AudioEl;
  play: () => Promise<void>;
  pause: () => void;
  load: () => void;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
};

const CRAFT_PEAK = 0.55;
const DONE_PEAK = 0.6;
const QUICK_FADE_MS = 140;
const COMPLETE_FADE_MS = 240;
const FADE_TICK_MS = 16;

let craftTemplate: AudioEl | null = null;
let doneTemplate: AudioEl | null = null;
let activeCraft: AudioEl | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let completeFadeTimer: ReturnType<typeof setTimeout> | null = null;
let generation = 0;

function resolveSampleUri(source: unknown): string | null {
  if (source == null) return null;
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const uri = (source as { uri?: string; default?: string }).uri
      ?? (source as { default?: string }).default;
    if (typeof uri === 'string' && uri.length > 0) return uri;
  }
  if (typeof source === 'number') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const rn = require('react-native') as {
        Image?: {
          resolveAssetSource?: (src: number) => { uri?: string } | undefined;
        };
      };
      const resolved = rn.Image?.resolveAssetSource?.(source);
      if (resolved?.uri) return resolved.uri;
    } catch {
      return null;
    }
  }
  return null;
}

function ensureCraftTemplate(): AudioEl | null {
  if (craftTemplate) return craftTemplate;
  if (typeof Audio === 'undefined') return null;
  const uri = resolveSampleUri(CRAFT_SAMPLE);
  if (!uri) return null;
  try {
    const el = new Audio(uri) as unknown as AudioEl;
    el.preload = 'auto';
    el.volume = 0;
    el.load();
    craftTemplate = el;
    return el;
  } catch {
    return null;
  }
}

function ensureDoneTemplate(): AudioEl | null {
  if (doneTemplate) return doneTemplate;
  if (typeof Audio === 'undefined') return null;
  const uri = resolveSampleUri(FABRICATE_DONE_SAMPLE);
  if (!uri) return null;
  try {
    const el = new Audio(uri) as unknown as AudioEl;
    el.preload = 'auto';
    el.volume = 0;
    el.load();
    doneTemplate = el;
    return el;
  } catch {
    return null;
  }
}

/** One-shot confirmation after a successful fabrication. */
export function playFabricateDoneSfx(): void {
  const template = ensureDoneTemplate();
  if (!template) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const peak = Math.max(0, Math.min(1, DONE_PEAK * getUiFeedbackVolumeScale()));
  if (peak <= 0.001) return;
  try {
    const node = template.cloneNode(true);
    node.muted = false;
    node.volume = peak;
    node.currentTime = 0;
    void node.play().catch(() => undefined);
  } catch {
    // ignore
  }
}

/** Phase hooks — complete plays fabricate_done; hold bed covers binding. */
export const fabricationAudioHooks: FabricationAudioHooks = {
  play: (cue) => {
    if (cue === 'fabrication_complete') {
      playFabricateDoneSfx();
    }
  },
};

function clearFadeTimers(): void {
  if (fadeTimer != null) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
  if (completeFadeTimer != null) {
    clearTimeout(completeFadeTimer);
    completeFadeTimer = null;
  }
}

function peakVolume(): number {
  return Math.max(0, Math.min(1, CRAFT_PEAK * getUiFeedbackVolumeScale()));
}

function hardStop(el: AudioEl | null): void {
  if (!el) return;
  try {
    el.pause();
    el.currentTime = 0;
    el.volume = 0;
  } catch {
    // ignore
  }
  if (activeCraft === el) activeCraft = null;
}

function fadeVolume(
  el: AudioEl,
  to: number,
  durationMs: number,
  onDone?: () => void,
): void {
  clearFadeTimers();
  const from = el.volume;
  const start = Date.now();
  const gen = generation;
  if (durationMs <= 0) {
    el.volume = Math.max(0, Math.min(1, to));
    onDone?.();
    return;
  }
  fadeTimer = setInterval(() => {
    if (gen !== generation || activeCraft !== el) {
      clearFadeTimers();
      return;
    }
    const t = Math.min(1, (Date.now() - start) / durationMs);
    el.volume = from + (to - from) * t;
    if (t >= 1) {
      clearFadeTimers();
      onDone?.();
    }
  }, FADE_TICK_MS);
}

/** Begin craft bed on fabricate press-in. */
export function startFabricationHoldSfx(): void {
  const template = ensureCraftTemplate();
  if (!template) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const peak = peakVolume();
  if (peak <= 0.001) return;

  generation += 1;
  clearFadeTimers();
  hardStop(activeCraft);

  try {
    const node = new Audio(template.src) as unknown as AudioEl;
    node.preload = 'auto';
    node.muted = false;
    node.volume = peak;
    node.currentTime = 0;
    activeCraft = node;
    const gen = generation;
    const onEnded = () => {
      if (gen !== generation) return;
      hardStop(node);
    };
    node.addEventListener('ended', onEnded);
    void node.play().catch(() => {
      if (gen === generation) hardStop(node);
    });
  } catch {
    activeCraft = null;
  }
}

/**
 * End craft bed.
 * - abort: finger released early — quick fade-out
 * - complete: hold finished — play remaining audio, fade near the end
 */
export function releaseFabricationHoldSfx(mode: 'abort' | 'complete'): void {
  const el = activeCraft;
  if (!el) return;
  const gen = generation;

  if (mode === 'abort') {
    fadeVolume(el, 0, QUICK_FADE_MS, () => {
      if (gen === generation) hardStop(el);
    });
    return;
  }

  // Complete: keep playing; fade out over the last COMPLETE_FADE_MS of the sample.
  clearFadeTimers();
  const scheduleEndFade = () => {
    if (gen !== generation || activeCraft !== el) return;
    let duration = Number.isFinite(el.duration) && el.duration > 0 ? el.duration : 1.33;
    const remainingMs = Math.max(0, (duration - el.currentTime) * 1000);
    const fadeMs = Math.min(COMPLETE_FADE_MS, Math.max(80, remainingMs));
    const delayMs = Math.max(0, remainingMs - fadeMs);
    completeFadeTimer = setTimeout(() => {
      if (gen !== generation || activeCraft !== el) return;
      fadeVolume(el, 0, fadeMs, () => {
        if (gen === generation) hardStop(el);
      });
    }, delayMs);
  };

  if (Number.isFinite(el.duration) && el.duration > 0) {
    scheduleEndFade();
  } else {
    // Duration may still be loading — wait briefly then schedule.
    completeFadeTimer = setTimeout(scheduleEndFade, 40);
  }
}

/** Hard-stop craft bed (unmount / disabled). */
export function stopFabricationHoldSfx(): void {
  generation += 1;
  clearFadeTimers();
  hardStop(activeCraft);
}
