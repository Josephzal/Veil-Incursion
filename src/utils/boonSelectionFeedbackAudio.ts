/**
 * Boon / requisition hold-to-bind SFX.
 * Hold bed plays while the offer is pressed; early release fades out quickly.
 * On successful 1s bind: fade hold out and immediately play select with a short fade.
 */

import { BOON_HOLD_SAMPLE, BOON_SELECT_SAMPLE } from './uiFeedbackAudioSamples';
import { getUiFeedbackVolumeScale } from './uiFeedbackAudio';

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

/** Peak volumes (0–1), before master UI feedback scale. */
export const BOON_HOLD_SFX_VOLUME = 0.22;
export const BOON_SELECT_SFX_VOLUME = 0.62;

const HOLD_ABORT_FADE_MS = 140;
const HOLD_COMPLETE_FADE_MS = 100;
/** Select needs a clear audible beat before fade — prior peak was too short to hear. */
const SELECT_PEAK_MS = 900;
const SELECT_FADE_MS = 450;
const FADE_TICK_MS = 16;

let holdTemplate: AudioEl | null = null;
let selectTemplate: AudioEl | null = null;
let activeHold: AudioEl | null = null;
let activeSelect: AudioEl | null = null;
let fadeTimer: ReturnType<typeof setInterval> | null = null;
let selectFadeTimer: ReturnType<typeof setTimeout> | null = null;
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

function ensureHoldTemplate(): AudioEl | null {
  if (holdTemplate) return holdTemplate;
  if (typeof Audio === 'undefined') return null;
  const uri = resolveSampleUri(BOON_HOLD_SAMPLE);
  if (!uri) return null;
  try {
    const el = new Audio(uri) as unknown as AudioEl;
    el.preload = 'auto';
    el.volume = 0;
    el.load();
    holdTemplate = el;
    return el;
  } catch {
    return null;
  }
}

function ensureSelectTemplate(): AudioEl | null {
  if (selectTemplate) return selectTemplate;
  if (typeof Audio === 'undefined') return null;
  const uri = resolveSampleUri(BOON_SELECT_SAMPLE);
  if (!uri) return null;
  try {
    const el = new Audio(uri) as unknown as AudioEl;
    el.preload = 'auto';
    el.volume = 0;
    el.load();
    selectTemplate = el;
    return el;
  } catch {
    return null;
  }
}

function clearFadeTimers(): void {
  if (fadeTimer != null) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
  if (selectFadeTimer != null) {
    clearTimeout(selectFadeTimer);
    selectFadeTimer = null;
  }
}

function holdPeakVolume(): number {
  return Math.max(0, Math.min(1, BOON_HOLD_SFX_VOLUME * getUiFeedbackVolumeScale()));
}

function selectPeakVolume(): number {
  return Math.max(0, Math.min(1, BOON_SELECT_SFX_VOLUME * getUiFeedbackVolumeScale()));
}

function hardStop(el: AudioEl | null, clearActive: 'hold' | 'select' | null): void {
  if (!el) return;
  try {
    el.pause();
    el.currentTime = 0;
    el.volume = 0;
  } catch {
    // ignore
  }
  if (clearActive === 'hold' && activeHold === el) activeHold = null;
  if (clearActive === 'select' && activeSelect === el) activeSelect = null;
}

function fadeVolume(
  el: AudioEl,
  to: number,
  durationMs: number,
  onDone?: () => void,
  isHold = true,
): void {
  if (isHold) {
    if (fadeTimer != null) {
      clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }
  const from = el.volume;
  const start = Date.now();
  const gen = generation;
  if (durationMs <= 0) {
    el.volume = Math.max(0, Math.min(1, to));
    onDone?.();
    return;
  }
  const timer = setInterval(() => {
    // Hold fades respect generation; select fades only care about their own node.
    if (isHold && gen !== generation) {
      clearInterval(timer);
      return;
    }
    if (isHold && activeHold !== el) {
      clearInterval(timer);
      return;
    }
    if (!isHold && activeSelect !== el) {
      clearInterval(timer);
      return;
    }
    const t = Math.min(1, (Date.now() - start) / durationMs);
    el.volume = from + (to - from) * t;
    if (t >= 1) {
      clearInterval(timer);
      if (isHold && fadeTimer === timer) fadeTimer = null;
      onDone?.();
    }
  }, FADE_TICK_MS);
  if (isHold) fadeTimer = timer;
}

/** Confirm one-shot — sustained peak, then a measured fade (must stay audible). */
export function playBoonSelectSfx(): void {
  const template = ensureSelectTemplate();
  if (!template) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const peak = selectPeakVolume();
  if (peak <= 0.001) return;

  hardStop(activeSelect, 'select');
  if (selectFadeTimer != null) {
    clearTimeout(selectFadeTimer);
    selectFadeTimer = null;
  }

  try {
    const node = new Audio(template.src) as unknown as AudioEl;
    node.preload = 'auto';
    node.muted = false;
    node.volume = peak;
    node.currentTime = 0;
    activeSelect = node;
    void node.play().catch(() => {
      if (activeSelect === node) hardStop(node, 'select');
    });
    // Select uses its own lifetime — hold generation bumps must not kill it.
    selectFadeTimer = setTimeout(() => {
      if (activeSelect !== node) return;
      fadeVolume(node, 0, SELECT_FADE_MS, () => {
        if (activeSelect === node) hardStop(node, 'select');
      }, false);
    }, SELECT_PEAK_MS);
  } catch {
    activeSelect = null;
  }
}

/** Begin hold bed on offer press-in. */
export function startBoonHoldSfx(): void {
  const template = ensureHoldTemplate();
  if (!template) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const peak = holdPeakVolume();
  if (peak <= 0.001) return;

  generation += 1;
  clearFadeTimers();
  hardStop(activeHold, 'hold');

  try {
    const node = new Audio(template.src) as unknown as AudioEl;
    node.preload = 'auto';
    node.muted = false;
    node.volume = peak;
    node.currentTime = 0;
    activeHold = node;
    const gen = generation;
    const onEnded = () => {
      if (gen !== generation) return;
      hardStop(node, 'hold');
    };
    node.addEventListener('ended', onEnded);
    void node.play().catch(() => {
      if (gen === generation) hardStop(node, 'hold');
    });
  } catch {
    activeHold = null;
  }
}

/**
 * End hold bed.
 * - abort: released early — quick fade-out
 * - complete: bind succeeded — fade hold out and fire select immediately
 */
export function releaseBoonHoldSfx(mode: 'abort' | 'complete'): void {
  const el = activeHold;
  const gen = generation;

  if (mode === 'complete') {
    if (el) {
      fadeVolume(el, 0, HOLD_COMPLETE_FADE_MS, () => {
        if (gen === generation) hardStop(el, 'hold');
      });
    }
    playBoonSelectSfx();
    return;
  }

  if (!el) return;
  fadeVolume(el, 0, HOLD_ABORT_FADE_MS, () => {
    if (gen === generation) hardStop(el, 'hold');
  });
}

/** Hard-stop hold bed (unmount / disabled). Leaves select confirm alone if playing. */
export function stopBoonHoldSfx(): void {
  generation += 1;
  if (fadeTimer != null) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
  hardStop(activeHold, 'hold');
}
