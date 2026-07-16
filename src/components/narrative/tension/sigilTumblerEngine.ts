/**
 * Sigil Tumbler — pure engine for the occult-tech lockpick minigame
 * (Mechanic_SigilTumbler). The player drives a wardpick needle around a circular
 * resonance ring, holds tension to find a hidden Resonance Window, then sets
 * four glyph tumblers on a randomized four-beat rhythm before Stability drains.
 *
 * Deterministic when seeded. No run-state mutation. Fixed standard difficulty —
 * randomization comes from the window angle, beat order, and starting phases,
 * never from difficulty scaling.
 */

import { hashSeed } from '../../../data/narrative/narrativeAssemblyCore';

export type SigilBeat = 'SLOW' | 'FAST';
export type SigilZone = 'INSIDE' | 'NEAR' | 'OUTSIDE';

export interface SigilTumbler {
  beat: SigilBeat;
  /** Full pulse period in seconds (glyph rises + falls once). */
  periodSec: number;
  /** Starting phase 0..1 so tumblers don't all sync on spawn. */
  startPhase: number;
}

export interface SigilTumblerPuzzle {
  puzzleId: string;
  /** Hidden sweet-spot angle centre (degrees, 0 = east, CCW+). */
  windowCenterDeg: number;
  /** Where the wardpick starts — always well outside the window. */
  startAngleDeg: number;
  tumblers: SigilTumbler[];
}

export const SIGIL_TUMBLER_CONFIG = {
  tumblerCount: 4,
  /** Total width of the resonance sweet spot (±20°). */
  resonanceWindowDeg: 40,
  /** Extra band beyond the window edge that still reads as "near". */
  nearBandDeg: 30,
  stabilityMax: 100,
  badSetPenalty: 20,
  drainOutsidePerSec: 12,
  drainNearPerSec: 4,
  drainInsidePerSec: 1,
  maxBadAttempts: 4,
  /** Total forgiving window (seconds) around the sync beat for a good set. */
  setWindowSec: 0.3,
  slowPeriodSec: 1.3,
  fastPeriodSec: 0.8,
  /** Phase at which the glyph crosses the sync line (peak of the pulse). */
  syncPhase: 0.5,
} as const;

const BEAT_PATTERNS: readonly SigilBeat[][] = [
  ['SLOW', 'FAST', 'FAST', 'SLOW'],
  ['FAST', 'SLOW', 'FAST', 'SLOW'],
  ['SLOW', 'SLOW', 'FAST', 'FAST'],
  ['FAST', 'FAST', 'SLOW', 'SLOW'],
  ['SLOW', 'FAST', 'SLOW', 'FAST'],
  ['FAST', 'SLOW', 'SLOW', 'FAST'],
];

export function normalizeDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

export function angularDistanceDeg(a: number, b: number): number {
  const diff = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return diff > 180 ? 360 - diff : diff;
}

export function zoneForAngle(puzzle: SigilTumblerPuzzle, angleDeg: number): SigilZone {
  const dist = angularDistanceDeg(angleDeg, puzzle.windowCenterDeg);
  const half = SIGIL_TUMBLER_CONFIG.resonanceWindowDeg / 2;
  if (dist <= half) return 'INSIDE';
  if (dist <= half + SIGIL_TUMBLER_CONFIG.nearBandDeg) return 'NEAR';
  return 'OUTSIDE';
}

export function drainPerSec(zone: SigilZone): number {
  switch (zone) {
    case 'INSIDE': return SIGIL_TUMBLER_CONFIG.drainInsidePerSec;
    case 'NEAR': return SIGIL_TUMBLER_CONFIG.drainNearPerSec;
    default: return SIGIL_TUMBLER_CONFIG.drainOutsidePerSec;
  }
}

/**
 * 0..1 proximity to the sweet-spot centre (1 = dead centre, 0 = ≥90° away).
 * Used only for UI hum/glow/jitter cues — the window itself stays hidden.
 */
export function resonanceProximity(puzzle: SigilTumblerPuzzle, angleDeg: number): number {
  const dist = angularDistanceDeg(angleDeg, puzzle.windowCenterDeg);
  return Math.max(0, 1 - dist / 90);
}

/** Triangle pulse: 0 at phase 0/1 (bottom), 1 at the sync phase (top). */
export function tumblerPos(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  const sync = SIGIL_TUMBLER_CONFIG.syncPhase;
  return p <= sync ? p / sync : (1 - p) / (1 - sync);
}

/** True when a set at this phase lands inside the ~0.3s sync window. */
export function isTimingGood(phase: number, periodSec: number): boolean {
  const p = ((phase % 1) + 1) % 1;
  const distSec = Math.abs(p - SIGIL_TUMBLER_CONFIG.syncPhase) * periodSec;
  return distSec <= SIGIL_TUMBLER_CONFIG.setWindowSec / 2;
}

function makeRng(seed: string): () => number {
  let s = hashSeed(seed) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function generateSigilTumbler(seed = 'sigil-tumbler:default'): SigilTumblerPuzzle {
  const rng = makeRng(seed);
  const windowCenterDeg = Math.floor(rng() * 360);
  // Start well outside the window (opposite side ± a little) so the player hunts.
  const startAngleDeg = normalizeDeg(windowCenterDeg + 180 + (rng() * 80 - 40));

  const pattern = BEAT_PATTERNS[Math.floor(rng() * BEAT_PATTERNS.length)]!;
  const tumblers: SigilTumbler[] = pattern
    .slice(0, SIGIL_TUMBLER_CONFIG.tumblerCount)
    .map((beat) => ({
      beat,
      periodSec: beat === 'SLOW'
        ? SIGIL_TUMBLER_CONFIG.slowPeriodSec
        : SIGIL_TUMBLER_CONFIG.fastPeriodSec,
      startPhase: rng(),
    }));

  return {
    puzzleId: seed,
    windowCenterDeg,
    startAngleDeg,
    tumblers,
  };
}
