/**
 * Combat Refactor Phase 5 — Combat Director balance constants.
 */

export const COMBAT_DIRECTOR_BALANCE = {
  depth1EarlyMaxPressure: 45,
  depth1LateMaxPressure: 58,
  depth2NormalMaxPressure: 70,
  depth3NormalMaxPressure: 85,

  earlyCriticalPressureDisallowed: true,

  maxHardCountersDepth1Early: 1,
  maxHardCountersDepth1Late: 2,
  maxHardCountersDepth2: 3,
  maxHardCountersDepth3: 5,

  depth1EarlyMaxHighIntents: 1,
  depth1LateMaxHighIntents: 2,
  depth2MaxHighIntents: 3,
  depth3MaxHighIntents: 4,

  depth1EarlyMaxCriticalIntents: 0,
  depth1LateMaxCriticalIntents: 0,
  depth2MaxCriticalIntents: 1,
  depth3MaxCriticalIntents: 2,

  depth1EarlyMaxLayeredEnemies: 1,
  depth1LateMaxLayeredEnemies: 2,

  depth1EarlyMaxObjectives: 1,
  depth1LateMaxObjectives: 1,
  depth2MaxObjectives: 2,
  depth3MaxObjectives: 2,

  /** Node index (nodesCleared) below this is "early" Depth 1. */
  depth1EarlyNodeIndexCap: 3,

  /** Reward multipliers by pressure label. */
  rewardMultiplierLow: 1,
  rewardMultiplierModerate: 1,
  rewardMultiplierHigh: 1.15,
  rewardMultiplierCritical: 1.35,

  rareLootBonusHighPct: 10,
  rareLootBonusCriticalPct: 25,
  creditsBonusHighPct: 10,
  creditsBonusCriticalPct: 25,

  /** Safety soft adjustments. */
  safetyArmorStackFloor: 1,
  safetyWardStackFloor: 1,
  safetyDamageSoftMult: 0.85,
  safetyHpSoftMult: 0.9,
  safetyTimerLengthen: 1,
  safetyIncomingMitigationPct: 8,

  /** Class fairness HP remaining targets (design guides). */
  depth1Encounter1HpRemainingMin: 0.8,
  depth1Encounter1HpRemainingMax: 0.95,
  depth1Encounter3HpRemainingMin: 0.6,
  depth1Encounter3HpRemainingMax: 0.85,
  depth1Encounter5HpRemainingMin: 0.45,
  depth1Encounter5HpRemainingMax: 0.75,

  classDamageSpreadWarnPct: 25,
  classTurnSpreadWarnPct: 25,
} as const;

export const COMBAT_JUICE_FEEDBACK_CONFIG = {
  enableScreenShake: true,
  enableHitStop: true,
  reduceFlashing: false,
  combatFeedbackIntensity: 1,
} as const;

/** Conservative hit-stop / shake defaults by event type. */
export const COMBAT_JUICE_DEFAULTS: Record<string, {
  hitStopMs: number;
  shakeIntensity: number;
  shakeDurationMs: number;
  uiPulse: boolean;
  cameraFocus?: boolean;
}> = {
  DAMAGE_LIGHT: { hitStopMs: 0, shakeIntensity: 0, shakeDurationMs: 0, uiPulse: false },
  DAMAGE_HEAVY: { hitStopMs: 70, shakeIntensity: 0.25, shakeDurationMs: 80, uiPulse: false },
  CRITICAL_HIT: { hitStopMs: 90, shakeIntensity: 0.3, shakeDurationMs: 90, uiPulse: true },
  KILL: { hitStopMs: 100, shakeIntensity: 0.35, shakeDurationMs: 100, uiPulse: true },
  ELITE_KILL: { hitStopMs: 140, shakeIntensity: 0.4, shakeDurationMs: 120, uiPulse: true, cameraFocus: true },
  BOSS_HIT: { hitStopMs: 80, shakeIntensity: 0.3, shakeDurationMs: 90, uiPulse: false },
  ARMOR_HIT: { hitStopMs: 20, shakeIntensity: 0, shakeDurationMs: 0, uiPulse: false },
  ARMOR_BREAK: { hitStopMs: 100, shakeIntensity: 0.2, shakeDurationMs: 80, uiPulse: true },
  WARD_HIT: { hitStopMs: 20, shakeIntensity: 0, shakeDurationMs: 0, uiPulse: false },
  WARD_BREAK: { hitStopMs: 100, shakeIntensity: 0.2, shakeDurationMs: 80, uiPulse: true },
  FRACTURE_APPLIED: { hitStopMs: 80, shakeIntensity: 0.15, shakeDurationMs: 60, uiPulse: true },
  FRACTURE_EXPLOITED: { hitStopMs: 90, shakeIntensity: 0.25, shakeDurationMs: 80, uiPulse: true },
  INTENT_COUNTERED: { hitStopMs: 70, shakeIntensity: 0.15, shakeDurationMs: 50, uiPulse: true },
  PERFECT_PARRY: { hitStopMs: 120, shakeIntensity: 0.3, shakeDurationMs: 90, uiPulse: true, cameraFocus: true },
  RIPOSTE: { hitStopMs: 100, shakeIntensity: 0.25, shakeDurationMs: 80, uiPulse: true },
  HEX_CORRECT_ROUND: { hitStopMs: 60, shakeIntensity: 0.1, shakeDurationMs: 40, uiPulse: true },
  ENVOY_CATALYST_RESONANCE: { hitStopMs: 70, shakeIntensity: 0.15, shakeDurationMs: 50, uiPulse: true },
  OBJECTIVE_COMPLETED: { hitStopMs: 40, shakeIntensity: 0, shakeDurationMs: 0, uiPulse: true },
  DIRTY_EXTRACTION_SURVIVED: { hitStopMs: 60, shakeIntensity: 0.1, shakeDurationMs: 40, uiPulse: true },
  DANGER_PULSE: { hitStopMs: 0, shakeIntensity: 0, shakeDurationMs: 0, uiPulse: true },
};

export function formatCombatDirectorBalanceSummary(): string {
  const c = COMBAT_DIRECTOR_BALANCE;
  return [
    'COMBAT DIRECTOR BALANCE (Phase 5)',
    `  Pressure caps: D1e≤${c.depth1EarlyMaxPressure} D1l≤${c.depth1LateMaxPressure} D2≤${c.depth2NormalMaxPressure} D3≤${c.depth3NormalMaxPressure}`,
    `  Hard counters: D1e≤${c.maxHardCountersDepth1Early} D1l≤${c.maxHardCountersDepth1Late} D2≤${c.maxHardCountersDepth2} D3≤${c.maxHardCountersDepth3}`,
    `  HIGH intents: D1e≤${c.depth1EarlyMaxHighIntents} D1l≤${c.depth1LateMaxHighIntents}`,
    `  Reward HIGH×${c.rewardMultiplierHigh} CRITICAL×${c.rewardMultiplierCritical}`,
  ].join('\n');
}
