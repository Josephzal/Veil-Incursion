/**
 * Scanner / overlay base chances by depth stage.
 * Anchor multipliers stay authored on anchors; these are the stage baselines.
 */

import type { DepthStage, DepthStageModifiers } from '../../types/worldState';

export const SCANNER_DEPTH_STAGE_MODIFIERS: Record<DepthStage, DepthStageModifiers> = {
  /** Depth 1 — readable; low unstable / anchor pressure. */
  THRESHOLD: {
    combatBias: 0.05,
    eliteBias: -0.1,
    anomalyBias: -0.1,
    echoBias: -0.2,
    anchorSignalChance: 0.05,
    rareLootBias: 0,
  },
  /** Depth 2 — Breach; twisted encounters matter. */
  BREACH: {
    combatBias: 0,
    eliteBias: 0.1,
    anomalyBias: 0.15,
    echoBias: 0.1,
    anchorSignalChance: 0.2,
    rareLootBias: 0.1,
  },
  /** Depth 3 — Deep Veil; high-value cargo + tension. */
  DEEP_VEIL: {
    combatBias: -0.05,
    eliteBias: 0.2,
    anomalyBias: 0.25,
    echoBias: 0.25,
    anchorSignalChance: 0.4,
    rareLootBias: 0.3,
  },
};

export const SCANNER_OPERATION_TARGET_CHANCE: Record<DepthStage, number> = {
  THRESHOLD: 0.08,
  BREACH: 0.22,
  DEEP_VEIL: 0.38,
};

export const SCANNER_ANCHOR_ASSAULT_CORE_CHANCE: Record<DepthStage, number> = {
  THRESHOLD: 0,
  BREACH: 0,
  DEEP_VEIL: 0.35,
};

export const SCANNER_ECHO_SIGNAL_CHANCE: Record<
  'LOW' | 'ELEVATED' | 'CRITICAL',
  Record<DepthStage, number>
> = {
  LOW: { THRESHOLD: 0, BREACH: 0.05, DEEP_VEIL: 0.1 },
  ELEVATED: { THRESHOLD: 0.02, BREACH: 0.12, DEEP_VEIL: 0.22 },
  CRITICAL: { THRESHOLD: 0.05, BREACH: 0.2, DEEP_VEIL: 0.35 },
};

export const SCANNER_ECHO_CAPS = {
  maxEncountersPerRun: 2,
  maxEncountersEchoRecoveryRun: 3,
  maxSignalsPerDepth: 1,
  maxLegendaryPerRun: 1,
} as const;

/**
 * High-value / high-risk overlay base notes — final rolls also use pressure,
 * cargo bias, and keepsakes in nodeGenerationContextEngine.
 */
export const SCANNER_OVERLAY_INTENT = {
  highValueResource: 'Stronger at Ley Nexus + Depth 2/3 rareLootBias',
  highRiskZone: 'Should pair with elevated reward tiers when stamped',
  scannerUncertaintyByDepth: 'Increases Breach → Deep Veil via distortion/law systems',
} as const;

export function formatScannerBalanceConfigSummary(): string {
  return [
    'SCANNER BALANCE CONFIG',
    `  anchorSignal: T=${SCANNER_DEPTH_STAGE_MODIFIERS.THRESHOLD.anchorSignalChance} B=${SCANNER_DEPTH_STAGE_MODIFIERS.BREACH.anchorSignalChance} D=${SCANNER_DEPTH_STAGE_MODIFIERS.DEEP_VEIL.anchorSignalChance}`,
    `  opTarget: T=${SCANNER_OPERATION_TARGET_CHANCE.THRESHOLD} B=${SCANNER_OPERATION_TARGET_CHANCE.BREACH} D=${SCANNER_OPERATION_TARGET_CHANCE.DEEP_VEIL}`,
    `  echo caps: ${SCANNER_ECHO_CAPS.maxEncountersPerRun}/run (${SCANNER_ECHO_CAPS.maxEncountersEchoRecoveryRun} on ECHO_RECOVERY), ${SCANNER_ECHO_CAPS.maxSignalsPerDepth}/depth`,
  ].join('\n');
}
