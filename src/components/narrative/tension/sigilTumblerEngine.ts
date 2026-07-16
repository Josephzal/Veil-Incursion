/**
 * Sigil Tumbler — pure engine for the occult-tech lockpick minigame
 * (Mechanic_SigilTumbler). The player drives a wardpick needle around a circular
 * resonance ring, holds tension to find a hidden Resonance Window, then seats
 * four glyph tumblers by releasing tension as each glyph crosses its sync line.
 *
 * Each glyph has its OWN hidden resonance angle and its OWN randomly-placed sync
 * line, so the player must re-aim the wardpick and re-time the release for every
 * glyph. Deterministic when seeded. No run-state mutation. Fixed standard
 * difficulty — randomization comes from angles, sync positions, and speeds.
 */

import { hashSeed } from '../../../data/narrative/narrativeAssemblyCore';

export type SigilZone = 'INSIDE' | 'NEAR' | 'OUTSIDE';

export interface SigilTumbler {
  /** Hidden sweet-spot angle centre for THIS glyph (degrees, 0 = east, CCW+). */
  windowCenterDeg: number;
  /** Full pulse period in seconds (glyph rises + falls once). */
  periodSec: number;
  /** Random sync-line position within the chamber (0 = bottom, 1 = top). */
  syncPos: number;
}

export interface SigilTumblerPuzzle {
  puzzleId: string;
  /** Where the wardpick starts — always well away from the first glyph. */
  startAngleDeg: number;
  /** Retained seed value used only for banner-line selection. */
  windowCenterDeg: number;
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
  /** Position tolerance (0..1 of travel) for the glyph overlapping the sync line. */
  syncPosTolerance: 0.14,
  /** Range the random sync line can occupy within the chamber. */
  syncPosMin: 0.3,
  syncPosMax: 0.85,
  slowPeriodSec: 1.3,
  fastPeriodSec: 0.8,
  /** Minimum angular separation between consecutive glyph resonance angles. */
  minAngleSeparationDeg: 60,
} as const;

export function normalizeDeg(d: number): number {
  return ((d % 360) + 360) % 360;
}

export function angularDistanceDeg(a: number, b: number): number {
  const diff = Math.abs(normalizeDeg(a) - normalizeDeg(b));
  return diff > 180 ? 360 - diff : diff;
}

export function zoneForAngle(centerDeg: number, angleDeg: number): SigilZone {
  const dist = angularDistanceDeg(angleDeg, centerDeg);
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
export function resonanceProximity(centerDeg: number, angleDeg: number): number {
  const dist = angularDistanceDeg(angleDeg, centerDeg);
  return Math.max(0, 1 - dist / 90);
}

/**
 * Triangle pulse: 0 at phase 0/1 (bottom of chamber), 1 at phase 0.5 (top).
 * The glyph always starts at the bottom (phase 0) when tension begins.
 */
export function tumblerPos(phase: number): number {
  const p = ((phase % 1) + 1) % 1;
  return p <= 0.5 ? p / 0.5 : (1 - p) / 0.5;
}

/** True when the glyph's rendered position overlaps its sync line. */
export function isTimingGood(pos: number, syncPos: number): boolean {
  return Math.abs(pos - syncPos) <= SIGIL_TUMBLER_CONFIG.syncPosTolerance;
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
  const {
    tumblerCount,
    minAngleSeparationDeg,
    syncPosMin,
    syncPosMax,
    slowPeriodSec,
    fastPeriodSec,
  } = SIGIL_TUMBLER_CONFIG;

  const tumblers: SigilTumbler[] = [];
  let prevAngle = Math.floor(rng() * 360);
  const firstAngle = prevAngle;
  const span = 360 - minAngleSeparationDeg * 2;
  for (let i = 0; i < tumblerCount; i += 1) {
    // Offset from the previous angle by at least minAngleSeparationDeg on either
    // side so the player must always re-aim the wardpick between glyphs.
    const angle = i === 0
      ? firstAngle
      : normalizeDeg(prevAngle + minAngleSeparationDeg + rng() * span);
    prevAngle = angle;
    tumblers.push({
      windowCenterDeg: angle,
      periodSec: rng() < 0.5 ? fastPeriodSec : slowPeriodSec,
      syncPos: syncPosMin + rng() * (syncPosMax - syncPosMin),
    });
  }

  // Start the wardpick well away from the first glyph's resonance angle.
  const startAngleDeg = normalizeDeg(firstAngle + 180 + (rng() * 80 - 40));

  return {
    puzzleId: seed,
    startAngleDeg,
    windowCenterDeg: firstAngle,
    tumblers,
  };
}
