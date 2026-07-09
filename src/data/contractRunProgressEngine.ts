import type { ContractRunProgress } from '../types/contract';
import type { IncursionNode } from '../types/game';
import { createEmptyContractRunProgress } from '../types/contract';

export function createInitialContractRunProgress(): ContractRunProgress {
  return createEmptyContractRunProgress();
}

export function recordContractDepthReached(
  progress: ContractRunProgress,
  depth: number,
): ContractRunProgress {
  return {
    ...progress,
    highestDepthReached: Math.max(progress.highestDepthReached, depth),
  };
}

export function recordContractEliteKill(
  progress: ContractRunProgress,
): ContractRunProgress {
  return {
    ...progress,
    eliteKills: progress.eliteKills + 1,
  };
}

export function recordContractDepthBossDefeated(
  progress: ContractRunProgress,
): ContractRunProgress {
  return {
    ...progress,
    depthBossDefeated: true,
  };
}

export function recordContractEmergencyRecall(
  progress: ContractRunProgress,
): ContractRunProgress {
  return {
    ...progress,
    emergencyRecallCompleted: true,
  };
}

export function recordContractOperationTargetCleared(
  progress: ContractRunProgress,
  node?: IncursionNode | null,
): ContractRunProgress {
  if (!node?.contextModifiers?.operationTag && !node?.contextModifiers?.anchorSignal) {
    return progress;
  }
  return {
    ...progress,
    operationTargetsCleared: progress.operationTargetsCleared + 1,
  };
}

export function recordContractAnchorSignalCleared(
  progress: ContractRunProgress,
): ContractRunProgress {
  return {
    ...progress,
    anchorSignalsCleared: progress.anchorSignalsCleared + 1,
  };
}

export function recordContractAnomalyCleared(
  progress: ContractRunProgress,
): ContractRunProgress {
  return {
    ...progress,
    anomaliesCleared: progress.anomaliesCleared + 1,
  };
}
