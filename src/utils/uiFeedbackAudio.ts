/**
 * Short UI feedback one-shots (buttons, scanner lips, contract accept).
 * Never throws into game flow.
 */

import {
  SCANNER_LIP_KEY_SAMPLE,
  TYPING_SAMPLE,
  UI_CLICK_SAMPLE,
} from './uiFeedbackAudioSamples';

type AudioEl = {
  src: string;
  volume: number;
  currentTime: number;
  muted: boolean;
  preload: string;
  cloneNode: (deep?: boolean) => AudioEl;
  play: () => Promise<void>;
  load: () => void;
};

const CLICK_VOLUME = 0.45;
const LIP_VOLUME = 0.1; // 0.55 − 25%
const TYPING_VOLUME = 0.55;
const CLICK_DEBOUNCE_MS = 28;

/** User sfx × master scale from audio prefs (0–1). */
let uiVolumeScale = 1;

let clickTemplate: AudioEl | null = null;
let lipTemplate: AudioEl | null = null;
let typingTemplate: AudioEl | null = null;
let lastClickAt = 0;
let gestureBound = false;

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

function makeTemplate(uri: string): AudioEl | null {
  if (typeof Audio === 'undefined') return null;
  try {
    const el = new Audio(uri) as unknown as AudioEl;
    el.preload = 'auto';
    el.volume = 0;
    el.load();
    return el;
  } catch {
    return null;
  }
}

function ensureTemplates(): void {
  if (!clickTemplate) {
    const uri = resolveSampleUri(UI_CLICK_SAMPLE);
    if (uri) clickTemplate = makeTemplate(uri);
  }
  if (!lipTemplate) {
    const uri = resolveSampleUri(SCANNER_LIP_KEY_SAMPLE);
    if (uri) lipTemplate = makeTemplate(uri);
  }
  if (!typingTemplate) {
    const uri = resolveSampleUri(TYPING_SAMPLE);
    if (uri) typingTemplate = makeTemplate(uri);
  }
}

function bindGestureUnlock(): void {
  if (gestureBound || typeof document === 'undefined') return;
  gestureBound = true;
  const warm = () => {
    ensureTemplates();
  };
  document.addEventListener('pointerdown', warm, { capture: true, passive: true });
  document.addEventListener('touchstart', warm, { capture: true, passive: true });
}

function playTemplate(template: AudioEl | null, volume: number): void {
  bindGestureUnlock();
  ensureTemplates();
  if (!template) return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  const scaled = volume * uiVolumeScale;
  if (scaled <= 0.001) return;
  try {
    const node = template.cloneNode(true);
    node.volume = Math.max(0, Math.min(1, scaled));
    node.muted = false;
    node.currentTime = 0;
    void node.play().catch(() => undefined);
  } catch {
    // ignore
  }
}

/** Scale UI one-shots by user sfx × master (0–1). */
export function setUiFeedbackVolumeScale(scale: number): void {
  uiVolumeScale = Math.max(0, Math.min(1, scale));
}

export function getUiFeedbackVolumeScale(): number {
  return uiVolumeScale;
}

/** Standard UI button click (HapticPressable / CTAs). */
export function playUiClick(): void {
  const now = Date.now();
  if (now - lastClickAt < CLICK_DEBOUNCE_MS) return;
  lastClickAt = now;
  ensureTemplates();
  playTemplate(clickTemplate, CLICK_VOLUME);
}

/** Scanner radar lip / blip key press. */
export function playScannerLipKey(): void {
  ensureTemplates();
  playTemplate(lipTemplate, LIP_VOLUME);
}

/** Contract board accept — typing confirmation. */
export function playContractAcceptTyping(): void {
  ensureTemplates();
  playTemplate(typingTemplate, TYPING_VOLUME);
}
