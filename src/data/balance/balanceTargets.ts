/**
 * Full Run Balance + Tuning Framework v1 — design targets (not enforced).
 *
 * These bands guide Phase B+ telemetry warnings. Do not hard-gate gameplay on them.
 */

/** Early / low-progression run outcome targets. */
export const BALANCE_TARGET_EARLY = {
  /** Depth 1 boss clear rate */
  depth1BossClear: { min: 0.65, max: 0.85 },
  /** Reach Depth 2 */
  reachDepth2: { min: 0.6, max: 0.8 },
  /** Reach Depth 3 */
  reachDepth3: { min: 0.25, max: 0.45 },
  /** Full 3-boss clear */
  fullClear: { min: 0.1, max: 0.25 },
  /** Any successful extraction */
  anyExtraction: { min: 0.5, max: 0.75 },
  /** Death while carrying valuable special cargo */
  deathWithValuableCargo: { min: 0.2, max: 0.4 },
} as const;

/** Later progression targets (more unlocked power). */
export const BALANCE_TARGET_LATE = {
  depth1BossClear: { min: 0.8, max: 0.95 },
  reachDepth2: { min: 0.75, max: 0.9 },
  reachDepth3: { min: 0.45, max: 0.7 },
  fullClear: { min: 0.25, max: 0.45 },
  anyExtraction: { min: 0.6, max: 0.85 },
} as const;

/**
 * Combat turn-length targets (tuning guides).
 * Depth → { normal, elite, boss } turn ranges [min, max].
 */
export const COMBAT_PACING_TARGETS = {
  normal: {
    1: [2, 4] as const,
    2: [3, 5] as const,
    3: [4, 6] as const,
  },
  elite: {
    1: [4, 6] as const,
    2: [5, 8] as const,
    3: [6, 10] as const,
  },
  boss: {
    1: [6, 9] as const,
    2: [8, 12] as const,
    3: [10, 15] as const,
  },
} as const;

/** Operation progress feel — ordinary ops complete in this many focused runs. */
export const OPERATION_COMPLETION_RUN_TARGET = { min: 3, max: 6 } as const;
