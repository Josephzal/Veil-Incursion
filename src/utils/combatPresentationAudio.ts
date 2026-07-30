/**
 * Phase 3M — combat presentation SFX.
 * Sample-backed cues only in live play (Aegis attack/ultimate, player impact).
 * Procedural Web Audio recipes remain for validation / deterministic tests.
 * Safe unlock after user gesture. Never throws into combat.
 */

import { getCombatPresentationSettings } from '../data/weaponCombatPresentation/presentationSettings';
import {
  AEGIS_ATTACK_SAMPLE,
  AEGIS_ULTIMATE_SAMPLE,
  PLAYER_IMPACT_SAMPLE,
} from './combatPresentationAudioSamples';

type OscKind = OscillatorType;

interface CueRecipe {
  layers: Array<{
    kind: OscKind;
    freq: number;
    freqEnd?: number;
    gain: number;
    durationMs: number;
    delayMs?: number;
    noise?: boolean;
  }>;
}

const CUE_RECIPES: Record<string, CueRecipe> = {};

function registerFamily(prefix: string, body: CueRecipe): void {
  const map: Record<string, CueRecipe> = {
    [`sfx.${prefix}.release`]: body,
    [`sfx.${prefix}.travel`]: {
      layers: [{ kind: 'triangle', freq: 420, freqEnd: 280, gain: 0.08, durationMs: 70 }],
    },
    [`sfx.${prefix}.flesh`]: {
      layers: [
        { kind: 'square', freq: 180, freqEnd: 90, gain: 0.11, durationMs: 55, noise: true },
      ],
    },
    [`sfx.${prefix}.ka`]: {
      layers: [{ kind: 'sawtooth', freq: 320, freqEnd: 140, gain: 0.1, durationMs: 70 }],
    },
    [`sfx.${prefix}.ow`]: {
      layers: [{ kind: 'sine', freq: 520, freqEnd: 260, gain: 0.09, durationMs: 90 }],
    },
    [`sfx.${prefix}.fracture`]: {
      layers: [{ kind: 'triangle', freq: 240, freqEnd: 80, gain: 0.1, durationMs: 100, noise: true }],
    },
    [`sfx.${prefix}.break`]: {
      layers: [{ kind: 'square', freq: 140, freqEnd: 60, gain: 0.12, durationMs: 110, noise: true }],
    },
    [`sfx.${prefix}.kill`]: {
      layers: [{ kind: 'sine', freq: 200, freqEnd: 90, gain: 0.1, durationMs: 130 }],
    },
    [`sfx.${prefix}.resource`]: {
      layers: [{ kind: 'sine', freq: 660, freqEnd: 880, gain: 0.06, durationMs: 80 }],
    },
    [`sfx.${prefix}.reload_sacrifice`]: {
      layers: [{ kind: 'triangle', freq: 300, freqEnd: 220, gain: 0.07, durationMs: 90 }],
    },
  };
  Object.assign(CUE_RECIPES, map);
}

registerFamily('longsword', {
  layers: [{ kind: 'triangle', freq: 680, freqEnd: 320, gain: 0.1, durationMs: 85 }],
});
registerFamily('paired', {
  layers: [
    { kind: 'sine', freq: 760, freqEnd: 400, gain: 0.07, durationMs: 55 },
    { kind: 'sine', freq: 820, freqEnd: 440, gain: 0.06, durationMs: 55, delayMs: 35 },
  ],
});
registerFamily('unmaker', {
  layers: [
    { kind: 'sawtooth', freq: 90, freqEnd: 45, gain: 0.14, durationMs: 140, noise: true },
  ],
});
registerFamily('revolver', {
  layers: [
    { kind: 'square', freq: 220, freqEnd: 90, gain: 0.1, durationMs: 45, noise: true },
    { kind: 'triangle', freq: 1100, freqEnd: 700, gain: 0.04, durationMs: 35, delayMs: 10 },
  ],
});
registerFamily('carbine', {
  layers: [{ kind: 'square', freq: 260, freqEnd: 120, gain: 0.07, durationMs: 35, noise: true }],
});
registerFamily('blackdoor', {
  layers: [
    { kind: 'sawtooth', freq: 70, freqEnd: 35, gain: 0.13, durationMs: 120, noise: true },
    { kind: 'sine', freq: 180, freqEnd: 90, gain: 0.08, durationMs: 100, delayMs: 20 },
  ],
});
registerFamily('vambrace', {
  layers: [{ kind: 'sine', freq: 480, freqEnd: 240, gain: 0.08, durationMs: 110 }],
});
registerFamily('scythe', {
  layers: [{ kind: 'triangle', freq: 360, freqEnd: 160, gain: 0.1, durationMs: 120 }],
});
registerFamily('heart', {
  layers: [
    { kind: 'sine', freq: 220, freqEnd: 180, gain: 0.07, durationMs: 90 },
    { kind: 'triangle', freq: 640, freqEnd: 420, gain: 0.05, durationMs: 70, delayMs: 30 },
  ],
});

// Aegis sample cue IDs — recipes exist for validation / deterministic fallback only.
CUE_RECIPES['sfx.aegis.attack'] = {
  layers: [{ kind: 'triangle', freq: 680, freqEnd: 320, gain: 0.1, durationMs: 85 }],
};
CUE_RECIPES['sfx.aegis.ultimate'] = {
  layers: [{ kind: 'sawtooth', freq: 520, freqEnd: 180, gain: 0.12, durationMs: 140 }],
};
// CONTACT after Aegis RELEASE — no second body hit under the metal sample.
CUE_RECIPES['sfx.aegis.contact_silent'] = { layers: [] };
CUE_RECIPES['sfx.player.impact'] = {
  layers: [{ kind: 'square', freq: 160, freqEnd: 70, gain: 0.12, durationMs: 90, noise: true }],
};

// Generic juice cue fallbacks
['damage_light', 'damage_heavy', 'critical_hit', 'kill', 'armor_hit', 'armor_break',
  'ward_hit', 'ward_break', 'fracture_applied', 'fracture_exploited'].forEach((key) => {
  CUE_RECIPES[`sfx.${key}`] = {
    layers: [{ kind: 'triangle', freq: 300, freqEnd: 120, gain: 0.08, durationMs: 70, noise: true }],
  };
});

type AudioBufferLike = {
  duration: number;
};

type AudioCtxLike = {
  state: string;
  currentTime: number;
  destination: unknown;
  resume: () => Promise<void>;
  createGain: () => {
    gain: { value: number; setValueAtTime: (v: number, t: number) => void; exponentialRampToValueAtTime: (v: number, t: number) => void };
    connect: (n: unknown) => void;
  };
  createOscillator: () => {
    type: string;
    frequency: { setValueAtTime: (v: number, t: number) => void; exponentialRampToValueAtTime: (v: number, t: number) => void };
    connect: (n: unknown) => void;
    start: (t?: number) => void;
    stop: (t?: number) => void;
  };
  createBufferSource: () => {
    buffer: unknown;
    connect: (n: unknown) => void;
    start: (t?: number) => void;
    stop: (t?: number) => void;
  };
  createBuffer: (channels: number, length: number, sampleRate: number) => {
    getChannelData: (ch: number) => Float32Array;
  };
  decodeAudioData: (data: ArrayBuffer) => Promise<AudioBufferLike>;
  sampleRate: number;
};

const SAMPLE_SOURCES: Record<string, unknown> = {
  'sfx.aegis.attack': AEGIS_ATTACK_SAMPLE,
  'sfx.aegis.ultimate': AEGIS_ULTIMATE_SAMPLE,
  'sfx.player.impact': PLAYER_IMPACT_SAMPLE,
};

const SAMPLE_GAIN: Record<string, number> = {
  'sfx.aegis.attack': 0.85,
  'sfx.aegis.ultimate': 0.9,
  'sfx.player.impact': 0.95,
};

/** Coalesce multiple pending loads of the same sample into one playback. */
const pendingPlayAfterLoad = new Set<string>();

let audioCtx: AudioCtxLike | null = null;
let masterGain: ReturnType<AudioCtxLike['createGain']> | null = null;
let activeVoices = 0;
const MAX_VOICES = 10;
const recentCueAt = new Map<string, number>();
let deterministicMode = false;
let lastPlayedCue: string | null = null;
const playedCues: string[] = [];
const decodedSamples = new Map<string, AudioBufferLike>();
const sampleLoadPromises = new Map<string, Promise<AudioBufferLike | null>>();

function getAudioContextConstructor(): (new () => AudioCtxLike) | null {
  if (typeof globalThis === 'undefined') return null;
  const g = globalThis as unknown as {
    AudioContext?: new () => AudioCtxLike;
    webkitAudioContext?: new () => AudioCtxLike;
  };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
}

function ensureContext(): AudioCtxLike | null {
  if (audioCtx) return audioCtx;
  const Ctor = getAudioContextConstructor();
  if (!Ctor) return null;
  try {
    audioCtx = new Ctor();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.7;
    masterGain.connect(audioCtx.destination);
    return audioCtx;
  } catch {
    audioCtx = null;
    masterGain = null;
    return null;
  }
}

function resolveSampleUri(source: unknown): string | null {
  if (source == null) return null;
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    const uri = (source as { uri?: string }).uri;
    if (typeof uri === 'string' && uri.length > 0) return uri;
  }
  if (typeof source === 'number') {
    try {
      // Soft require keeps Node presentation tests free of react-native transforms.
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

async function loadSampleBuffer(cueId: string): Promise<AudioBufferLike | null> {
  const cached = decodedSamples.get(cueId);
  if (cached) return cached;
  const inflight = sampleLoadPromises.get(cueId);
  if (inflight) return inflight;

  const promise = (async (): Promise<AudioBufferLike | null> => {
    const ctx = ensureContext();
    const source = SAMPLE_SOURCES[cueId];
    if (!ctx || source == null || typeof ctx.decodeAudioData !== 'function') return null;
    const uri = resolveSampleUri(source);
    if (!uri || typeof fetch !== 'function') return null;
    try {
      const response = await fetch(uri);
      if (!response.ok) return null;
      const raw = await response.arrayBuffer();
      // Safari requires a detachable copy for decodeAudioData.
      const buffer = await ctx.decodeAudioData(raw.slice(0));
      decodedSamples.set(cueId, buffer);
      return buffer;
    } catch {
      return null;
    }
  })();

  sampleLoadPromises.set(cueId, promise);
  try {
    return await promise;
  } finally {
    sampleLoadPromises.delete(cueId);
  }
}

function playDecodedSample(
  ctx: AudioCtxLike,
  buffer: AudioBufferLike,
  volume: number,
  cueGain: number,
): boolean {
  if (!masterGain || activeVoices >= MAX_VOICES) return false;
  try {
    const start = ctx.currentTime;
    const gainNode = ctx.createGain();
    const peak = Math.max(0.001, cueGain * volume);
    const dur = Math.max(0.05, buffer.duration || 0.4);
    gainNode.gain.setValueAtTime(0.0001, start);
    gainNode.gain.exponentialRampToValueAtTime(peak, start + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    gainNode.connect(masterGain);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gainNode);
    src.start(start);
    src.stop(start + dur + 0.02);
    activeVoices += 1;
    setTimeout(() => {
      activeVoices = Math.max(0, activeVoices - 1);
    }, Math.ceil(dur * 1000) + 40);
    return true;
  } catch {
    return false;
  }
}

function tryPlaySampleCue(cueId: string, volume: number): boolean | 'pending' {
  const source = SAMPLE_SOURCES[cueId];
  if (source == null || !(cueId in SAMPLE_SOURCES)) return false;
  const ctx = ensureContext();
  if (!ctx || !masterGain) return false;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }
  const cached = decodedSamples.get(cueId);
  if (cached) {
    return playDecodedSample(ctx, cached, volume, SAMPLE_GAIN[cueId] ?? 0.85);
  }
  const alreadyPending = pendingPlayAfterLoad.has(cueId);
  pendingPlayAfterLoad.add(cueId);
  if (!alreadyPending) {
    void loadSampleBuffer(cueId).then((buffer) => {
      const shouldPlay = pendingPlayAfterLoad.delete(cueId);
      if (!buffer || !shouldPlay) return;
      // Play once decode finishes so the first swing is not silent.
      playDecodedSample(ctx, buffer, volume, SAMPLE_GAIN[cueId] ?? 0.85);
    });
  }
  return 'pending';
}

function preloadAegisSamples(): void {
  Object.keys(SAMPLE_SOURCES).forEach((cueId) => {
    if (SAMPLE_SOURCES[cueId] == null) return;
    void loadSampleBuffer(cueId);
  });
}

export function unlockCombatPresentationAudio(): void {
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }
  preloadAegisSamples();
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { unlockBgm } = require('./bgmController') as { unlockBgm: () => void };
    unlockBgm();
  } catch {
    // BGM optional
  }
}

export function setCombatPresentationAudioDeterministic(on: boolean): void {
  deterministicMode = on;
  if (on) {
    playedCues.length = 0;
    lastPlayedCue = null;
  }
}

export function getCombatPresentationPlayedCues(): readonly string[] {
  return [...playedCues];
}

export function clearCombatPresentationPlayedCues(): void {
  playedCues.length = 0;
  lastPlayedCue = null;
}

export function resolveCombatPresentationCueRecipe(cueId: string): CueRecipe | null {
  return CUE_RECIPES[cueId] ?? {
    layers: [{ kind: 'sine', freq: 280, freqEnd: 140, gain: 0.06, durationMs: 60 }],
  };
}

export function playCombatPresentationCue(cueId: string, opts?: { force?: boolean }): boolean {
  const settings = getCombatPresentationSettings();
  if (settings.sfxMuted && !opts?.force) return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && !opts?.force) {
    return false;
  }

  const now = Date.now();
  const last = recentCueAt.get(cueId) ?? 0;
  if (!opts?.force && now - last < 28 && cueId.includes('carbine')) {
    // Group carbine tails — allow release but skip duplicate body.
    if (cueId.endsWith('.travel') || cueId.endsWith('.flesh')) {
      recentCueAt.set(cueId, now);
      return false;
    }
  }
  // Avoid stacking Aegis metal hits when burst flesh maps to the same sample.
  if (!opts?.force && cueId.startsWith('sfx.aegis.') && now - last < 50) {
    recentCueAt.set(cueId, now);
    return false;
  }
  recentCueAt.set(cueId, now);

  lastPlayedCue = cueId;
  playedCues.push(cueId);
  if (playedCues.length > 64) playedCues.shift();

  if (deterministicMode) return true;

  // Live combat: only play cues that have real samples (Aegis attack/ultimate, player impact).
  // Procedural family beeps stay off until their weapon SFX are authored.
  const hasSample = cueId in SAMPLE_SOURCES && SAMPLE_SOURCES[cueId] != null;
  if (!opts?.force && !hasSample) {
    const silentRecipe = CUE_RECIPES[cueId];
    if (silentRecipe && silentRecipe.layers.length === 0) return true;
    return false;
  }

  const ctx = ensureContext();
  if (!ctx || !masterGain) return false;
  if (ctx.state === 'suspended') {
    void ctx.resume().catch(() => undefined);
  }
  if (activeVoices >= MAX_VOICES) return false;

  const volume = Math.max(0, Math.min(1, settings.sfxVolume));
  masterGain.gain.value = volume * 0.85;

  const sampleResult = tryPlaySampleCue(cueId, volume);
  if (sampleResult === true) return true;
  if (sampleResult === 'pending') {
    // Sample still loading — skip procedural so first attack does not beep over the asset.
    return true;
  }

  const recipe = resolveCombatPresentationCueRecipe(cueId);
  if (!recipe) return false;
  if (recipe.layers.length === 0) return true;

  try {
    for (const layer of recipe.layers) {
      if (activeVoices >= MAX_VOICES) break;
      const delay = (layer.delayMs ?? 0) / 1000;
      const start = ctx.currentTime + delay;
      const dur = Math.max(0.02, layer.durationMs / 1000);
      const gainNode = ctx.createGain();
      const peak = Math.max(0.001, layer.gain * volume);
      gainNode.gain.setValueAtTime(0.0001, start);
      gainNode.gain.exponentialRampToValueAtTime(peak, start + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      gainNode.connect(masterGain);

      if (layer.noise) {
        const length = Math.max(1, Math.floor(ctx.sampleRate * dur));
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * 0.35;
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(gainNode);
        src.start(start);
        src.stop(start + dur + 0.02);
      } else {
        const osc = ctx.createOscillator();
        osc.type = layer.kind;
        osc.frequency.setValueAtTime(layer.freq, start);
        if (layer.freqEnd) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, layer.freqEnd), start + dur);
        }
        osc.connect(gainNode);
        osc.start(start);
        osc.stop(start + dur + 0.02);
      }
      activeVoices += 1;
      setTimeout(() => {
        activeVoices = Math.max(0, activeVoices - 1);
      }, layer.durationMs + (layer.delayMs ?? 0) + 40);
    }
    return true;
  } catch {
    return false;
  }
}

export function silenceCombatPresentationAudio(): void {
  if (masterGain) {
    try {
      masterGain.gain.value = 0;
    } catch {
      // ignore
    }
  }
}
