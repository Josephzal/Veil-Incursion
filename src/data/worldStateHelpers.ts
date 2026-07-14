import type {
  AnchorStage,
  DepthGenerationContext,
  DepthStage,
  DepthStageModifiers,
  NodePressureBand,
} from '../types/worldState';
import { getLevelsPerDistrict } from '../types/sectorPacing';
import {
  SCANNER_ANCHOR_ASSAULT_CORE_CHANCE,
  SCANNER_DEPTH_STAGE_MODIFIERS,
  SCANNER_ECHO_CAPS,
  SCANNER_ECHO_SIGNAL_CHANCE,
  SCANNER_OPERATION_TARGET_CHANCE,
} from './balance/scannerBalanceConfig';
import {
  OPERATION_BALANCE_CONTRIBUTION,
  OPERATION_BALANCE_DEFAULT_AFTERMATH_RUNS,
  OPERATION_BALANCE_DEFAULT_MAX_RUNS,
  OPERATION_BALANCE_MAX_SAFEHOUSE_BANK_ACTIONS,
  OPERATION_BALANCE_MAX_TARGET_RESOURCE_STACKS_PER_RUN,
  OPERATION_BALANCE_PROGRESS_REQUIRED,
} from './balance/operationBalanceConfig';

export const DEPTH_STAGE_MODIFIERS: Record<DepthStage, DepthStageModifiers> = SCANNER_DEPTH_STAGE_MODIFIERS;

export const ANCHOR_ASSAULT_CORE_CHANCE: Record<DepthStage, number> = SCANNER_ANCHOR_ASSAULT_CORE_CHANCE;

/** Base chance a node receives an Operation Target overlay by macro depth. */
export const OPERATION_TARGET_CHANCE: Record<DepthStage, number> = SCANNER_OPERATION_TARGET_CHANCE;

export const ECHO_SIGNAL_CHANCE: Record<
  'LOW' | 'ELEVATED' | 'CRITICAL',
  Record<DepthStage, number>
> = SCANNER_ECHO_SIGNAL_CHANCE;

export const MAX_ECHO_ENCOUNTERS_PER_RUN = SCANNER_ECHO_CAPS.maxEncountersPerRun;
export const MAX_ECHO_ENCOUNTERS_ECHO_RECOVERY_RUN = SCANNER_ECHO_CAPS.maxEncountersEchoRecoveryRun;
export const MAX_ECHO_SIGNALS_PER_DEPTH = SCANNER_ECHO_CAPS.maxSignalsPerDepth;
export const MAX_LEGENDARY_ECHO_ENCOUNTERS_PER_RUN = SCANNER_ECHO_CAPS.maxLegendaryPerRun;

export function resolveMaxEchoEncountersPerRun(
  isEchoRecoveryOperation: boolean,
): number {
  return isEchoRecoveryOperation
    ? MAX_ECHO_ENCOUNTERS_ECHO_RECOVERY_RUN
    : MAX_ECHO_ENCOUNTERS_PER_RUN;
}

export const DEFAULT_OPERATION_PROGRESS_REQUIRED = OPERATION_BALANCE_PROGRESS_REQUIRED;

export const OPERATION_CONTRIBUTION_VALUES = OPERATION_BALANCE_CONTRIBUTION;

/** Max target-resource stacks credited toward operation progress per run. */
export const MAX_OPERATION_TARGET_RESOURCE_STACKS_PER_RUN =
  OPERATION_BALANCE_MAX_TARGET_RESOURCE_STACKS_PER_RUN;

/** Max safehouse bank actions credited toward Extraction Surge per run. */
export const MAX_SAFEHOUSE_BANK_CONTRIBUTION_ACTIONS =
  OPERATION_BALANCE_MAX_SAFEHOUSE_BANK_ACTIONS;

export const DEFAULT_OPERATION_MAX_RUNS = OPERATION_BALANCE_DEFAULT_MAX_RUNS;
export const DEFAULT_OPERATION_AFTERMATH_RUNS = OPERATION_BALANCE_DEFAULT_AFTERMATH_RUNS;

export function getDepthStage(depthIndex: 1 | 2 | 3): DepthStage {
  if (depthIndex === 1) return 'THRESHOLD';
  if (depthIndex === 2) return 'BREACH';
  return 'DEEP_VEIL';
}

export function getAnchorStage(depthStage: DepthStage): AnchorStage {
  if (depthStage === 'THRESHOLD') return 'TRACE';
  if (depthStage === 'BREACH') return 'BREACH';
  return 'CORE';
}

export function getNodePressureBand(nodeIndexWithinDepth: number): NodePressureBand {
  const levels = getLevelsPerDistrict();
  const lowEnd = Math.max(1, Math.round((levels * 5) / 15));
  const midEnd = Math.max(lowEnd + 1, Math.round((levels * 10) / 15));
  if (nodeIndexWithinDepth <= lowEnd) return 'LOW';
  if (nodeIndexWithinDepth <= midEnd) return 'MEDIUM';
  return 'HIGH';
}

export function depthIndexFromDistrict(district: 1 | 2 | 3): 1 | 2 | 3 {
  return district;
}

export function depthIndexFromNodesCleared(nodesCleared: number): 1 | 2 | 3 {
  const levels = getLevelsPerDistrict();
  if (nodesCleared < levels) return 1;
  if (nodesCleared < levels * 2) return 2;
  return 3;
}

export function localNodeIndexWithinDepth(nodesCleared: number): number {
  const levels = getLevelsPerDistrict();
  const clearedInDepth = nodesCleared % levels;
  return clearedInDepth + 1;
}

export function buildDepthGenerationContext(
  depthIndex: 1 | 2 | 3,
  nodeIndexWithinDepth: number,
): DepthGenerationContext {
  const depthStage = getDepthStage(depthIndex);
  return {
    depthStage,
    depthIndex,
    nodeIndexWithinDepth,
    depthStageModifiers: DEPTH_STAGE_MODIFIERS[depthStage],
  };
}

export function buildDepthGenerationContextFromNodesCleared(
  nodesCleared: number,
): DepthGenerationContext {
  return buildDepthGenerationContext(
    depthIndexFromNodesCleared(nodesCleared),
    localNodeIndexWithinDepth(nodesCleared),
  );
}

export function operationProgressPercent(progressCurrent: number, progressRequired: number): number {
  if (progressRequired <= 0) return 0;
  return Math.min(100, Math.round((progressCurrent / progressRequired) * 100));
}
