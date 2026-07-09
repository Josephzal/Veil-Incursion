import type { ContractExtractionKind } from '../types/contract';
import type { ActiveIncursionState } from '../types/game';

export function resolveContractExtractionKind(inc: ActiveIncursionState): ContractExtractionKind {
  if (inc.contractRunProgress.emergencyRecallCompleted) return 'EMERGENCY_RECALL';
  if (inc.masterLinkUsed) return 'MASTER_LINK';
  if (inc.clearedSafeAnchors.length > 0) return 'SAFE_ANCHOR';
  return 'STANDARD';
}
