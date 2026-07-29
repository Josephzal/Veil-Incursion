/**
 * WU-3 — shared weapon ultimate interaction contracts.
 * Grades, session lifecycle, and accessibility input mode.
 */

export type WeaponUltimateGrade = 'STANDARD' | 'CLEAN' | 'PERFECT';

export type WeaponUltimateSessionPhase =
  | 'IDLE'
  | 'OPEN'
  | 'INTERACTING'
  | 'COMMITTED'
  | 'CANCELLED';

export type WeaponUltimateInputMode = 'FULL' | 'SIMPLIFIED';

export type WeaponUltimateWiredKind =
  | 'THREEFOLD_BRAND'
  | 'ZERO_PROTOCOL'
  | 'NULL_CIRCUIT';

export interface WeaponUltimateRawPerformance {
  tapCount?: number;
  nodesCompleted?: number;
  hitCount?: number;
  /** When true, grade resolves to STANDARD regardless of raw metrics. */
  forceStandard?: boolean;
}

export interface WeaponUltimateResolvedPerformance {
  grade: WeaponUltimateGrade;
  raw: WeaponUltimateRawPerformance;
  /** Effective metric used for damage after STANDARD floor. */
  effectiveTaps?: number;
  effectiveNodes?: number;
  effectiveHits?: number;
}

export interface WeaponUltimateAccessibilityOptions {
  simplifiedUltimateInputs: boolean;
  /** OS / media reduced-motion hint — enlarges timing windows when true. */
  reducedMotion: boolean;
}
