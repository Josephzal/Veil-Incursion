import type {
  AnchorStage,
  DepthGenerationContext,
  DepthStage,
  DepthStageModifiers,
  NodePressureBand,
} from '../types/worldState';

export const DEPTH_STAGE_MODIFIERS: Record<DepthStage, DepthStageModifiers> = {
  THRESHOLD: {
    combatBias: 0.05,
    eliteBias: -0.1,
    anomalyBias: -0.1,
    echoBias: -0.2,
    anchorSignalChance: 0.05,
    rareLootBias: 0,
  },
  BREACH: {
    combatBias: 0,
    eliteBias: 0.1,
    anomalyBias: 0.15,
    echoBias: 0.1,
    anchorSignalChance: 0.2,
    rareLootBias: 0.1,
  },
  DEEP_VEIL: {
    combatBias: -0.05,
    eliteBias: 0.2,
    anomalyBias: 0.25,
    echoBias: 0.25,
    anchorSignalChance: 0.4,
    rareLootBias: 0.3,
  },
};

export const ANCHOR_ASSAULT_CORE_CHANCE: Record<DepthStage, number> = {
  THRESHOLD: 0,
  BREACH: 0,
  DEEP_VEIL: 0.35,
};

export const ECHO_SIGNAL_CHANCE: Record<
  'LOW' | 'ELEVATED' | 'CRITICAL',
  Record<DepthStage, number>
> = {
  LOW: { THRESHOLD: 0, BREACH: 0.05, DEEP_VEIL: 0.1 },
  ELEVATED: { THRESHOLD: 0.02, BREACH: 0.12, DEEP_VEIL: 0.22 },
  CRITICAL: { THRESHOLD: 0.05, BREACH: 0.2, DEEP_VEIL: 0.35 },
};

export const MAX_ECHO_ENCOUNTERS_PER_RUN = 2;
export const MAX_LEGENDARY_ECHO_ENCOUNTERS_PER_RUN = 1;

export const DEFAULT_OPERATION_PROGRESS_REQUIRED = 100;

export const OPERATION_CONTRIBUTION_VALUES = {
  successfulExtraction: 1,
  defeatDepthBoss: 2,
  defeatEcho: 3,
  defeatAnchorElite: 4,
  clearAnchorCore: 10,
  extractTargetResourceStack: 1,
} as const;

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
  if (nodeIndexWithinDepth <= 5) return 'LOW';
  if (nodeIndexWithinDepth <= 10) return 'MEDIUM';
  return 'HIGH';
}

export function depthIndexFromDistrict(district: 1 | 2 | 3): 1 | 2 | 3 {
  return district;
}

export function depthIndexFromNodesCleared(nodesCleared: number): 1 | 2 | 3 {
  if (nodesCleared < 15) return 1;
  if (nodesCleared < 30) return 2;
  return 3;
}

export function localNodeIndexWithinDepth(nodesCleared: number): number {
  const clearedInDepth = nodesCleared % 15;
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
