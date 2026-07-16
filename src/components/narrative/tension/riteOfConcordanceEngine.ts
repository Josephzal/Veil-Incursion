/**
 * Rite of Concordance — pure engine for the ritual-cleanse minigame
 * (Mechanic_RiteOfConcordance). Three corrupted ritual threads (Blood, Ash, Void)
 * each carry a distorted occult waveform. The player tunes a counter-chant
 * waveform per thread — Phase (chant timing), Frequency (ritual cadence), and
 * Intensity (offering pressure) — until the cleansing pattern overlays the
 * corruption trace closely enough (Concordance ≥ threshold) to purify it.
 *
 * A light hostility layer — Dissonance Bursts — periodically destabilizes one
 * unlocked thread; the player must raise its Concordance above threshold before
 * the burst lands or lose Stability.
 *
 * Deterministic when seeded. No run-state mutation. Fixed standard difficulty —
 * randomization comes from target waveform shapes, starting offset, which thread
 * destabilizes, and the burst rhythm, never from depth/class scaling.
 */

import { hashSeed } from '../../../data/narrative/narrativeAssemblyCore';

export type RiteThreadId = 'BLOOD' | 'ASH' | 'VOID';
export type RiteProperty = 'phase' | 'frequency' | 'intensity';

export interface RiteWaveParams {
  /** Chant timing — cyclic 0..1 (wraps). */
  phase: number;
  /** Ritual cadence — cycles across the thread. */
  frequency: number;
  /** Offering pressure — waveform amplitude. */
  intensity: number;
}

export interface RiteThread {
  id: RiteThreadId;
  /** Corruption trace the counter-chant must overlay. */
  target: RiteWaveParams;
  /** Counter-chant starting parameters (always out of concordance). */
  start: RiteWaveParams;
}

export interface RiteOfConcordancePuzzle {
  puzzleId: string;
  threads: RiteThread[];
  /** Seconds to wait before each successive Dissonance Burst. */
  burstIntervalsSec: number[];
  /** Preferred thread index for each burst (skipped if already cleansed). */
  burstThreadPicks: number[];
}

export const RITE_CONFIG = {
  threadCount: 3,
  alignmentThreshold: 0.85,
  stabilityMax: 100,
  burstFailPenalty: 15,
  wrongAdjustPenalty: 5,
  burstWindowSec: 3,
  burstIntervalMinSec: 6,
  burstIntervalMaxSec: 9,
  phaseStep: 0.02,
  freqStep: 0.05,
  intensityStep: 0.03,
  freqMin: 0.6,
  freqMax: 2.6,
  intensityMin: 0.25,
  intensityMax: 1,
  /** Visual cycles-across-band multiplier (shared by engine + UI). */
  waveCycleBase: 2,
} as const;

export const RITE_THREAD_IDS: readonly RiteThreadId[] = ['BLOOD', 'ASH', 'VOID'];

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizePhase(p: number): number {
  return ((p % 1) + 1) % 1;
}

/** Cyclic distance between two phases (0..0.5). */
export function phaseDistance(a: number, b: number): number {
  const d = Math.abs(normalizePhase(a) - normalizePhase(b));
  return d > 0.5 ? 1 - d : d;
}

/**
 * Concordance 0..1 — how closely the counter-chant overlays the corruption
 * trace. 1 = perfect overlay. Averages the normalized Phase/Frequency/Intensity
 * errors so all three properties matter.
 */
export function concordance(params: RiteWaveParams, target: RiteWaveParams): number {
  const ePhase = phaseDistance(params.phase, target.phase) / 0.5;
  const eFreq = Math.abs(params.frequency - target.frequency) / (RITE_CONFIG.freqMax - RITE_CONFIG.freqMin);
  const eInt = Math.abs(params.intensity - target.intensity) / (RITE_CONFIG.intensityMax - RITE_CONFIG.intensityMin);
  const err = (ePhase + eFreq + eInt) / 3;
  return clamp(1 - err, 0, 1);
}

/** Step a single property up/down within its (clamped or cyclic) range. */
export function adjustParams(
  params: RiteWaveParams,
  property: RiteProperty,
  dir: 1 | -1,
): RiteWaveParams {
  switch (property) {
    case 'phase':
      return { ...params, phase: normalizePhase(params.phase + dir * RITE_CONFIG.phaseStep) };
    case 'frequency':
      return {
        ...params,
        frequency: clamp(params.frequency + dir * RITE_CONFIG.freqStep, RITE_CONFIG.freqMin, RITE_CONFIG.freqMax),
      };
    case 'intensity':
    default:
      return {
        ...params,
        intensity: clamp(params.intensity + dir * RITE_CONFIG.intensityStep, RITE_CONFIG.intensityMin, RITE_CONFIG.intensityMax),
      };
  }
}

/**
 * Waveform height at x (0..1) for rendering — a smoky occult wave. Shared by the
 * engine so UI and any tests agree. Returns roughly [-intensity, +intensity].
 */
export function riteWaveY(params: RiteWaveParams, x01: number): number {
  const cycles = params.frequency * RITE_CONFIG.waveCycleBase;
  return params.intensity * Math.sin(2 * Math.PI * (cycles * x01 + params.phase));
}

interface Rng {
  next: () => number;
  range: (min: number, max: number) => number;
  int: (minInclusive: number, maxInclusive: number) => number;
  sign: () => 1 | -1;
}

function makeRng(seed: string): Rng {
  let s = hashSeed(seed) >>> 0;
  const next = (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

function buildThread(id: RiteThreadId, rng: Rng): RiteThread {
  const { freqMin, freqMax, intensityMin, intensityMax } = RITE_CONFIG;
  const freqRange = freqMax - freqMin;
  const intRange = intensityMax - intensityMin;

  const target: RiteWaveParams = {
    phase: rng.next(),
    frequency: rng.range(freqMin + freqRange * 0.15, freqMax - freqRange * 0.15),
    intensity: rng.range(intensityMin + intRange * 0.2, intensityMax - intRange * 0.1),
  };

  // Starting offsets give a per-property normalized error in ~[0.2, 0.45]: enough
  // work to feel like cleansing, never below the win-able range.
  const phaseErr = rng.range(0.2, 0.45) * 0.5; // cyclic distance
  const freqErr = rng.range(0.2, 0.45) * freqRange;
  const intErr = rng.range(0.2, 0.45) * intRange;

  const start: RiteWaveParams = {
    phase: normalizePhase(target.phase + rng.sign() * phaseErr),
    frequency: clamp(target.frequency + rng.sign() * freqErr, freqMin, freqMax),
    intensity: clamp(target.intensity + rng.sign() * intErr, intensityMin, intensityMax),
  };

  return { id, target, start };
}

export function generateRiteOfConcordance(seed = 'rite-of-concordance:default'): RiteOfConcordancePuzzle {
  const rng = makeRng(seed);
  const threads = RITE_THREAD_IDS.map((id) => buildThread(id, rng));

  const burstIntervalsSec: number[] = [];
  const burstThreadPicks: number[] = [];
  for (let i = 0; i < 24; i += 1) {
    burstIntervalsSec.push(
      Number(rng.range(RITE_CONFIG.burstIntervalMinSec, RITE_CONFIG.burstIntervalMaxSec).toFixed(2)),
    );
    burstThreadPicks.push(rng.int(0, RITE_CONFIG.threadCount - 1));
  }

  return { puzzleId: seed, threads, burstIntervalsSec, burstThreadPicks };
}

export function isThreadCleansed(alignment: number): boolean {
  return alignment >= RITE_CONFIG.alignmentThreshold;
}
