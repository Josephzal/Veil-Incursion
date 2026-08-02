/**
 * Phase 3M — combat presentation SFX.
 * Sample-backed cues for weapon attacks, reloads, parry, snare, and player impact.
 * Procedural Web Audio recipes remain for validation / deterministic tests.
 * Safe unlock after user gesture. Never throws into combat.
 */

import { getCombatPresentationSettings } from '../data/weaponCombatPresentation/presentationSettings';
import {
  AEGIS_ATTACK_SAMPLE,
  AEGIS_MISS_SAMPLE,
  AEGIS_PARRY_SAMPLE,
  AEGIS_PLAYER_BUFF_SAMPLE,
  AEGIS_RUIN_SAMPLE,
  AEGIS_ULTIMATE2_SAMPLE,
  AEGIS_ULTIMATE_SAMPLE,
  CARBINE_BURST_SAMPLE,
  CARBINE_RELOAD_SAMPLE,
  ENVOY_DOT_SAMPLE,
  ENVOY_HIT_IMPACT_SAMPLE,
  CRITICAL_HIT_SAMPLE,
  FRACTURE_BREAK_SAMPLE,
  HEART_ATTACK_SAMPLE,
  HEX_DOT_SAMPLE,
  HEX_SNARE_SAMPLE,
  PAIRED_ATTACK2_SAMPLE,
  PAIRED_ATTACK_SAMPLE,
  PAIRED_ULT1_SAMPLE,
  PAIRED_ULT2_SAMPLE,
  PAIRED_ULT3_SAMPLE,
  PLAYER_IMPACT_SAMPLE,
  REVOLVER_RELOAD_SAMPLE,
  REVOLVER_SHOT_SAMPLE,
  SCYTHE_ATTACK_SAMPLE,
  SCYTHE_IMPACT_SAMPLE,
  SCYTHE_ULTIMATE_SAMPLE,
  SHOTGUN_BLAST_SAMPLE,
  SHOTGUN_RELOAD_SAMPLE,
  UNMAKER_ATTACK_SAMPLE,
  UNMAKER_ULTIMATE_SAMPLE,
  VAMBRACE_ATTACK_SAMPLE,
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

CUE_RECIPES['sfx.aegis.attack'] = {
  layers: [{ kind: 'triangle', freq: 680, freqEnd: 320, gain: 0.1, durationMs: 85 }],
};
/** Aegis miss / evade — replaces weapon attack release when the enemy phases. */
CUE_RECIPES['sfx.aegis.miss'] = {
  layers: [
    { kind: 'sine', freq: 280, freqEnd: 120, gain: 0.07, durationMs: 90 },
    { kind: 'triangle', freq: 160, freqEnd: 70, gain: 0.05, durationMs: 110, delayMs: 20 },
  ],
};
/** Longsword swing whoosh — smear / release beat for Warden's Strike. */
CUE_RECIPES['sfx.aegis.longsword_swing'] = {
  layers: [
    { kind: 'sine', freq: 520, freqEnd: 240, gain: 0.06, durationMs: 70 },
    { kind: 'triangle', freq: 380, freqEnd: 160, gain: 0.05, durationMs: 90, delayMs: 12 },
  ],
};
/** Longsword sharp contact — tip burst frame. */
CUE_RECIPES['sfx.aegis.longsword_impact'] = {
  layers: [{ kind: 'triangle', freq: 720, freqEnd: 280, gain: 0.12, durationMs: 55 }],
};
/** Longsword low body impact — follows sharp contact. */
CUE_RECIPES['sfx.aegis.longsword_body'] = {
  layers: [
    { kind: 'square', freq: 140, freqEnd: 55, gain: 0.09, durationMs: 95, noise: true },
  ],
};
CUE_RECIPES['sfx.aegis.ultimate'] = {
  layers: [{ kind: 'sawtooth', freq: 520, freqEnd: 180, gain: 0.12, durationMs: 140 }],
};
CUE_RECIPES['sfx.aegis.ultimate2'] = {
  layers: [{ kind: 'triangle', freq: 400, freqEnd: 160, gain: 0.1, durationMs: 160 }],
};
CUE_RECIPES['sfx.aegis.contact_silent'] = { layers: [] };
CUE_RECIPES['sfx.aegis.parry'] = {
  layers: [{ kind: 'triangle', freq: 900, freqEnd: 400, gain: 0.1, durationMs: 70 }],
};
CUE_RECIPES['sfx.unmaker.attack'] = {
  layers: [{ kind: 'sawtooth', freq: 90, freqEnd: 45, gain: 0.14, durationMs: 140, noise: true }],
};
CUE_RECIPES['sfx.unmaker.ultimate'] = {
  layers: [{ kind: 'sawtooth', freq: 70, freqEnd: 35, gain: 0.16, durationMs: 180, noise: true }],
};
CUE_RECIPES['sfx.paired.attack'] = {
  layers: [{ kind: 'sine', freq: 760, freqEnd: 400, gain: 0.07, durationMs: 55 }],
};
CUE_RECIPES['sfx.paired.attack2'] = {
  layers: [{ kind: 'sine', freq: 820, freqEnd: 440, gain: 0.06, durationMs: 55 }],
};
CUE_RECIPES['sfx.paired.ult1'] = {
  layers: [{ kind: 'sine', freq: 780, freqEnd: 420, gain: 0.07, durationMs: 50 }],
};
CUE_RECIPES['sfx.paired.ult2'] = {
  layers: [{ kind: 'sine', freq: 820, freqEnd: 440, gain: 0.07, durationMs: 50 }],
};
CUE_RECIPES['sfx.paired.ult3'] = {
  layers: [{ kind: 'sine', freq: 860, freqEnd: 460, gain: 0.07, durationMs: 50 }],
};
CUE_RECIPES['sfx.paired.ult_flurry'] = { layers: [] };
CUE_RECIPES['sfx.hex.snare'] = {
  layers: [{ kind: 'triangle', freq: 400, freqEnd: 180, gain: 0.08, durationMs: 90 }],
};
CUE_RECIPES['sfx.aegis.ruin'] = {
  layers: [{ kind: 'sawtooth', freq: 120, freqEnd: 50, gain: 0.12, durationMs: 140, noise: true }],
};
CUE_RECIPES['sfx.aegis.player_buff'] = {
  layers: [{ kind: 'sine', freq: 480, freqEnd: 720, gain: 0.08, durationMs: 110 }],
};
CUE_RECIPES['sfx.envoy.dot'] = {
  layers: [{ kind: 'sine', freq: 280, freqEnd: 140, gain: 0.07, durationMs: 90 }],
};
/** Vambrace / Heart's Due enemy hit impact — sample-backed, short fade. */
CUE_RECIPES['sfx.envoy.hit_impact'] = {
  layers: [
    { kind: 'square', freq: 160, freqEnd: 60, gain: 0.1, durationMs: 70, noise: true },
  ],
};
CUE_RECIPES['sfx.hex.dot'] = {
  layers: [{ kind: 'triangle', freq: 320, freqEnd: 160, gain: 0.07, durationMs: 80 }],
};
CUE_RECIPES['sfx.fracture.break'] = {
  layers: [{ kind: 'square', freq: 200, freqEnd: 80, gain: 0.11, durationMs: 100, noise: true }],
};
CUE_RECIPES['sfx.scythe.impact'] = {
  layers: [{ kind: 'triangle', freq: 300, freqEnd: 120, gain: 0.09, durationMs: 90 }],
};
CUE_RECIPES['sfx.scythe.ultimate'] = {
  layers: [{ kind: 'sawtooth', freq: 200, freqEnd: 80, gain: 0.11, durationMs: 140, noise: true }],
};
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
  'sfx.aegis.miss': AEGIS_MISS_SAMPLE,
  'sfx.aegis.longsword_swing': AEGIS_ATTACK_SAMPLE,
  'sfx.aegis.longsword_impact': AEGIS_ATTACK_SAMPLE,
  'sfx.aegis.longsword_body': PLAYER_IMPACT_SAMPLE,
  'sfx.aegis.ultimate': AEGIS_ULTIMATE_SAMPLE,
  'sfx.aegis.ultimate2': AEGIS_ULTIMATE2_SAMPLE,
  'sfx.aegis.parry': AEGIS_PARRY_SAMPLE,
  'sfx.player.impact': PLAYER_IMPACT_SAMPLE,
  'sfx.unmaker.attack': UNMAKER_ATTACK_SAMPLE,
  'sfx.unmaker.ultimate': UNMAKER_ULTIMATE_SAMPLE,
  'sfx.paired.attack': PAIRED_ATTACK_SAMPLE,
  'sfx.paired.attack2': PAIRED_ATTACK2_SAMPLE,
  'sfx.paired.ult1': PAIRED_ULT1_SAMPLE,
  'sfx.paired.ult2': PAIRED_ULT2_SAMPLE,
  'sfx.paired.ult3': PAIRED_ULT3_SAMPLE,
  'sfx.revolver.release': REVOLVER_SHOT_SAMPLE,
  'sfx.revolver.reload_sacrifice': REVOLVER_RELOAD_SAMPLE,
  'sfx.blackdoor.release': SHOTGUN_BLAST_SAMPLE,
  'sfx.blackdoor.reload_sacrifice': SHOTGUN_RELOAD_SAMPLE,
  'sfx.carbine.release': CARBINE_BURST_SAMPLE,
  'sfx.carbine.reload_sacrifice': CARBINE_RELOAD_SAMPLE,
  'sfx.heart.release': HEART_ATTACK_SAMPLE,
  'sfx.vambrace.release': VAMBRACE_ATTACK_SAMPLE,
  'sfx.scythe.release': SCYTHE_ATTACK_SAMPLE,
  'sfx.scythe.impact': SCYTHE_IMPACT_SAMPLE,
  'sfx.scythe.ultimate': SCYTHE_ULTIMATE_SAMPLE,
  'sfx.hex.snare': HEX_SNARE_SAMPLE,
  'sfx.aegis.ruin': AEGIS_RUIN_SAMPLE,
  'sfx.aegis.player_buff': AEGIS_PLAYER_BUFF_SAMPLE,
  'sfx.envoy.dot': ENVOY_DOT_SAMPLE,
  'sfx.envoy.hit_impact': ENVOY_HIT_IMPACT_SAMPLE,
  'sfx.critical_hit': CRITICAL_HIT_SAMPLE,
  'sfx.hex.dot': HEX_DOT_SAMPLE,
  'sfx.fracture.break': FRACTURE_BREAK_SAMPLE,
};

const SAMPLE_GAIN: Record<string, number> = {
  'sfx.aegis.attack': 1,
  'sfx.aegis.miss': 1,
  'sfx.aegis.longsword_swing': 0.72,
  'sfx.aegis.longsword_impact': 1,
  'sfx.aegis.longsword_body': 0.85,
  'sfx.aegis.ultimate': 1,
  'sfx.aegis.ultimate2': 1,
  'sfx.aegis.parry': 1,
  'sfx.player.impact': 1,
  'sfx.unmaker.attack': 1,
  'sfx.unmaker.ultimate': 1,
  'sfx.paired.attack': 1,
  'sfx.paired.attack2': 1,
  'sfx.paired.ult1': 1,
  'sfx.paired.ult2': 1,
  'sfx.paired.ult3': 1,
  'sfx.revolver.release': 4,
  'sfx.revolver.reload_sacrifice': 1,
  'sfx.blackdoor.release': .65,
  'sfx.blackdoor.reload_sacrifice': 1,
  'sfx.carbine.release': 1,
  'sfx.carbine.reload_sacrifice': .1,
  'sfx.heart.release': 1,
  'sfx.vambrace.release': .55,
  'sfx.scythe.release': 1,
  'sfx.scythe.impact': 1,
  'sfx.scythe.ultimate': 1,
  'sfx.hex.snare': 1,
  'sfx.aegis.ruin': 1,
  'sfx.aegis.player_buff': 1,
  'sfx.envoy.dot': 1,
  'sfx.envoy.hit_impact': 1,
  'sfx.critical_hit': 5,
  'sfx.hex.dot': 1,
  'sfx.fracture.break': 1,
};

const PAIRED_SECOND_STRIKE_DELAY_MS = 95;
/** Scythe impact follows the basic attack swing shortly after. */
const SCYTHE_IMPACT_DELAY_MS = 300;
/** Scythe ultimate lead-in, then attack. */
const SCYTHE_ULT_FOLLOW_ATTACK_MS = 700;
/** Gap between Paired Blades ultimate flurry hits. */
const PAIRED_ULT_FLURRY_GAP_MS = 72;
const PAIRED_ULT_CUE_IDS = [
  'sfx.paired.ult1',
  'sfx.paired.ult2',
  'sfx.paired.ult3',
] as const;

/**
 * Each of ult1/2/3 twice (6 hits), shuffled so the same cue never plays back-to-back.
 */
function buildPairedUltFlurryOrder(): readonly (typeof PAIRED_ULT_CUE_IDS)[number][] {
  const fallback: (typeof PAIRED_ULT_CUE_IDS)[number][] = [
    'sfx.paired.ult1',
    'sfx.paired.ult2',
    'sfx.paired.ult3',
    'sfx.paired.ult1',
    'sfx.paired.ult2',
    'sfx.paired.ult3',
  ];
  for (let attempt = 0; attempt < 48; attempt += 1) {
    const bag: (typeof PAIRED_ULT_CUE_IDS)[number][] = [
      ...PAIRED_ULT_CUE_IDS,
      ...PAIRED_ULT_CUE_IDS,
    ];
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = bag[i];
      bag[i] = bag[j];
      bag[j] = tmp;
    }
    let ok = true;
    for (let i = 1; i < bag.length; i += 1) {
      if (bag[i] === bag[i - 1]) {
        ok = false;
        break;
      }
    }
    if (ok) return bag;
  }
  return fallback;
}

/** Play Paired Blades ultimate as a 6-hit rapid flurry (2× each ult sample, no consecutive repeats). */
export function playPairedBladesUltimateFlurry(): void {
  const order = buildPairedUltFlurryOrder();
  order.forEach((cueId, index) => {
    setTimeout(() => {
      playCombatPresentationCue(cueId, { force: true });
    }, index * PAIRED_ULT_FLURRY_GAP_MS);
  });
}

const SAMPLE_FADE_OUT_MS: Partial<Record<string, number>> = {
  'sfx.aegis.parry': 800,
  'sfx.aegis.ultimate2': 1300,
  'sfx.scythe.release': 1200,
  'sfx.scythe.impact': 10,
  'sfx.scythe.ultimate': 800,
  'sfx.heart.release': 10000,
  'sfx.vambrace.release': 800,
  // Punch then die immediately — almost the whole ~260ms clip is the fade.
  'sfx.envoy.hit_impact': 200,
};

/** Hex Shot attack/release cues blocked while the reload minigame is open. */
const HEX_ATTACK_CUE_IDS = new Set([
  'sfx.revolver.release',
  'sfx.blackdoor.release',
  'sfx.carbine.release',
]);
let hexReloadSuppressesAttackSfx = false;

/** Gate Hex attack SFX off for the duration of Phase-Shift / flow-state reload. */
export function setHexReloadSuppressesAttackSfx(active: boolean): void {
  hexReloadSuppressesAttackSfx = active;
}

export function getHexReloadSuppressesAttackSfx(): boolean {
  return hexReloadSuppressesAttackSfx;
}

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
  opts?: { fadeOutMs?: number },
): boolean {
  if (!masterGain || activeVoices >= MAX_VOICES) return false;
  try {
    const start = ctx.currentTime;
    const gainNode = ctx.createGain();
    const peak = Math.max(0.001, cueGain * volume);
    const dur = Math.max(0.05, buffer.duration || 0.4);
    const fadeOutSec = opts?.fadeOutMs != null
      ? Math.min(dur * 0.95, Math.max(0.04, opts.fadeOutMs / 1000))
      : 0;
    if (fadeOutSec > 0) {
      const holdEnd = Math.max(start, start + dur - fadeOutSec);
      gainNode.gain.setValueAtTime(peak, start);
      gainNode.gain.setValueAtTime(peak, holdEnd);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    } else {
      // Flat gain — no fade in/out on authored samples.
      gainNode.gain.setValueAtTime(peak, start);
    }
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
  const fadeOutMs = SAMPLE_FADE_OUT_MS[cueId];
  const playOpts = fadeOutMs != null ? { fadeOutMs } : undefined;
  const cached = decodedSamples.get(cueId);
  if (cached) {
    return playDecodedSample(ctx, cached, volume, SAMPLE_GAIN[cueId] ?? 0.85, playOpts);
  }
  const alreadyPending = pendingPlayAfterLoad.has(cueId);
  pendingPlayAfterLoad.add(cueId);
  if (!alreadyPending) {
    void loadSampleBuffer(cueId).then((buffer) => {
      const shouldPlay = pendingPlayAfterLoad.delete(cueId);
      if (!buffer || !shouldPlay) return;
      // Play once decode finishes so the first swing is not silent.
      playDecodedSample(ctx, buffer, volume, SAMPLE_GAIN[cueId] ?? 0.85, playOpts);
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

/** Vambrace / Heart's Due only — Scythe keeps its own impact chain. */
const ENVOY_SOFT_HIT_IMPACT_CUES = new Set([
  'sfx.vambrace.release',
  'sfx.heart.release',
]);

function layerEnvoyHitImpact(
  cueId: string,
  opts?: { force?: boolean; skipScytheImpact?: boolean; skipImpactThud?: boolean },
): void {
  if (opts?.skipImpactThud) return;
  if (!ENVOY_SOFT_HIT_IMPACT_CUES.has(cueId)) return;
  playCombatPresentationCue('sfx.envoy.hit_impact', {
    force: true,
    skipImpactThud: true,
  });
}

export function playCombatPresentationCue(
  cueId: string,
  opts?: { force?: boolean; skipScytheImpact?: boolean; skipImpactThud?: boolean },
): boolean {
  const settings = getCombatPresentationSettings();
  if (settings.sfxMuted && !opts?.force) return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden' && !opts?.force) {
    return false;
  }
  // Never play Hex weapon attack SFX while the reload minigame is active.
  if (
    !opts?.force
    && hexReloadSuppressesAttackSfx
    && HEX_ATTACK_CUE_IDS.has(cueId)
  ) {
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

  // Paired Blades ultimate — replace single release with rapid 6-hit flurry.
  if (cueId === 'sfx.paired.ult_flurry') {
    playPairedBladesUltimateFlurry();
    return true;
  }

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
  if (sampleResult === true || sampleResult === 'pending') {
    // Paired Blades — second blade follows shortly after the first.
    if (cueId === 'sfx.paired.attack') {
      setTimeout(() => {
        playCombatPresentationCue('sfx.paired.attack2', { force: true });
      }, PAIRED_SECOND_STRIKE_DELAY_MS);
    }
    // Scythe ultimate — lead-in, then attack (no impact chain on that follow-up).
    if (cueId === 'sfx.scythe.ultimate') {
      setTimeout(() => {
        playCombatPresentationCue('sfx.scythe.release', {
          force: true,
          skipScytheImpact: true,
        });
      }, SCYTHE_ULT_FOLLOW_ATTACK_MS);
    }
    // Scythe basic — impact follows attack.
    if (cueId === 'sfx.scythe.release' && !opts?.skipScytheImpact) {
      setTimeout(() => {
        playCombatPresentationCue('sfx.scythe.impact', { force: true });
      }, SCYTHE_IMPACT_DELAY_MS);
    }
    layerEnvoyHitImpact(cueId, opts);
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
      // Flat gain — no fade envelope on procedural fallbacks either.
      gainNode.gain.setValueAtTime(peak, start);
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
    if (cueId === 'sfx.paired.attack') {
      setTimeout(() => {
        playCombatPresentationCue('sfx.paired.attack2', { force: true });
      }, PAIRED_SECOND_STRIKE_DELAY_MS);
    }
    if (cueId === 'sfx.scythe.ultimate') {
      setTimeout(() => {
        playCombatPresentationCue('sfx.scythe.release', {
          force: true,
          skipScytheImpact: true,
        });
      }, SCYTHE_ULT_FOLLOW_ATTACK_MS);
    }
    if (cueId === 'sfx.scythe.release' && !opts?.skipScytheImpact) {
      setTimeout(() => {
        playCombatPresentationCue('sfx.scythe.impact', { force: true });
      }, SCYTHE_IMPACT_DELAY_MS);
    }
    layerEnvoyHitImpact(cueId, opts);
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
