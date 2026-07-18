import type { BetrayalSeverity, ContractOutcomeKind } from './betrayal';
import type { ContractBoundContext, ContractGenerationDebug } from './contractProcedural';
import type { ResourceCategory, ResourceItemId } from './resourceItem';
import type { CabalEmployerId, SectorId } from './worldState';

export type ContractObjectiveKind =
  | 'EXTRACT_STABLE_RESOURCE'
  | 'EXTRACT_SPONSOR_RESOURCE'
  | 'RECOVER_INTEL'
  | 'RECOVER_ECONOMY_INTEL'
  | 'EXTRACT_UNSTABLE_CARGO'
  | 'RECOVER_APEX_CARGO'
  | 'RECOVER_CONTRABAND'
  | 'DEFEAT_ELITE'
  | 'COMPLETE_EMERGENCY_RECALL'
  | 'DEFEAT_DEPTH_BOSS'
  | 'REACH_DEPTH_AND_EXTRACT'
  | 'CLEAR_OPERATION_TARGET';

export type ContractDifficulty = 1 | 2 | 3 | 4 | 5;

export interface ContractRewardPackage {
  credits: number;
  reputation: number;
  rareLootBonusPct?: number;
  resourceBonusIds?: ResourceItemId[];
}

export interface ContractBonusObjective {
  text: string;
  kind: 'SAFE_EXTRACTION' | 'EARLY_EXTRACTION' | 'ELITE_KILL' | 'DEPTH_EXTRACT' | 'ANOMALY_CLEAR';
}

export interface GeneratedContract {
  id: string;
  sponsorId: CabalEmployerId;
  title: string;
  objectiveKind: ContractObjectiveKind;
  objectiveText: string;
  targetResourceId?: ResourceItemId;
  /** Alternate valid targets (any one satisfies quantity rules). */
  targetResourceOptions?: ResourceItemId[];
  targetQuantity: number;
  targetCategory?: ResourceCategory;
  validSectorIds: readonly SectorId[];
  recommendedSectorIds: readonly SectorId[];
  requiredDepth?: 1 | 2 | 3;
  requiresEmergencyRecall?: boolean;
  requiredEliteKills?: number;
  requiredOperationTargets?: number;
  bonusObjective?: ContractBonusObjective;
  reward: ContractRewardPackage;
  bonusReward?: Partial<ContractRewardPackage>;
  difficulty: ContractDifficulty;
  /** Minimum Breach Grade required to deploy this contract (Phase 1D). */
  minBreachGrade?: import('./progression').BreachGradeId;
  refreshLabel: string;
  /** Contracts v2 — contextual binding metadata. */
  boundContext?: ContractBoundContext;
  titleHash?: string;
  recentMemoryKey?: string;
  generationDebug?: ContractGenerationDebug;
}

export type SelectedContractState =
  | { kind: 'INDEPENDENT' }
  | { kind: 'SPONSOR'; contract: GeneratedContract; selectedAtRunIndex: number };

export interface ContractBoardState {
  contracts: GeneratedContract[];
  selectedContract: SelectedContractState;
  boardRefreshRunIndex: number;
  /** Last sponsor the player selected a contract for or deployed with — defaults board filter. */
  lastUsedSponsorId: CabalEmployerId | null;
}

export type KeepsakeSealedClauseKind =
  | 'OPERATION_TARGET'
  | 'EXTRACT_TWO_CARGO'
  | 'DEFEAT_ELITE'
  | 'CLEAR_ANCHOR'
  | 'COMPLETE_DEPTH_2'
  | 'NO_DIRTY_EXTRACTION';

export interface KeepsakeSealedClause {
  kind: KeepsakeSealedClauseKind;
  text: string;
}

/** Frozen snapshot copied into run state at descent — cannot change mid-run. */
export interface ActiveRunContract {
  contractId: string | null;
  sponsorId: CabalEmployerId | null;
  title: string;
  objectiveKind: ContractObjectiveKind | null;
  objectiveText: string;
  targetResourceId?: ResourceItemId;
  targetResourceOptions?: ResourceItemId[];
  targetQuantity?: number;
  targetCategory?: ResourceCategory;
  validSectorIds: readonly SectorId[];
  recommendedSectorIds: readonly SectorId[];
  requiredDepth?: 1 | 2 | 3;
  requiresEmergencyRecall?: boolean;
  requiredEliteKills?: number;
  requiredOperationTargets?: number;
  bonusObjectiveText?: string;
  bonusObjectiveKind?: ContractBonusObjective['kind'];
  reward: ContractRewardPackage | null;
  bonusReward?: Partial<ContractRewardPackage>;
  difficulty: ContractDifficulty;
  /** Minimum Breach Grade required (copied from board contract). */
  minBreachGrade?: import('./progression').BreachGradeId;
  selectedAtRunIndex: number;
  /** Contract Seal — optional sealed clause appended at run start. */
  keepsakeSealedClause?: KeepsakeSealedClause | null;
  /** Mirror Writ — mirrored side objective for double-or-break payout. */
  keepsakeMirroredObjective?: KeepsakeMirroredObjective | null;
  boundContext?: ContractBoundContext;
}

export interface KeepsakeMirroredObjective {
  category: import('./expeditionKeepsake').KeepsakeMirrorCategory;
  text: string;
  targetValue: number;
  progressValue?: number;
}

export interface ContractRunProgress {
  highestDepthReached: number;
  eliteKills: number;
  depthBossDefeated: boolean;
  emergencyRecallCompleted: boolean;
  operationTargetsCleared: number;
  anomaliesCleared: number;
  anchorSignalsCleared: number;
}

export type ContractExtractionKind =
  | 'SAFE_ANCHOR'
  | 'EMERGENCY_RECALL'
  | 'MASTER_LINK'
  | 'STANDARD';

export type ContractResultStatus = 'NONE' | 'SUCCESS' | 'FAILED' | 'PENDING_DELIVERY';

export interface ContractResult {
  status: ContractResultStatus;
  title: string;
  sponsorId: CabalEmployerId | null;
  objectiveText: string;
  progressText: string;
  reward: ContractRewardPackage | null;
  reputationAwarded: number;
  creditsAwarded: number;
  resourceBonusIds: ResourceItemId[];
  bonusObjectiveMet: boolean;
  bonusObjectiveText?: string;
  bonusProgressText?: string;
  bonusCreditsAwarded: number;
  bonusReputationAwarded: number;
  sealedClauseMet?: boolean;
  sealedClauseText?: string;
  sealedClauseProgressText?: string;
  sealedClauseCreditsBonus?: number;
  sealedClauseReputationBonus?: number;
  mirroredObjectiveMet?: boolean;
  mirroredObjectiveText?: string;
  mirroredObjectiveProgressText?: string;
  mirroredCreditsBonus?: number;
  mirroredReputationBonus?: number;
  /** Detailed routing outcome when betrayal v1 applies. */
  outcomeKind?: ContractOutcomeKind;
  betrayalSeverity?: BetrayalSeverity;
  finalCargoDestination?: string;
  originalSponsorRepDelta?: number;
  rivalSponsorId?: CabalEmployerId | null;
  rivalSponsorRepDelta?: number;
  betrayalSummary?: string | null;
  boundContextReason?: import('./contractProcedural').ContractSourceKind;
  linkedOperationTitle?: string;
  linkedAnchorDisplayName?: string;
}

export function createEmptyContractRunProgress(): ContractRunProgress {
  return {
    highestDepthReached: 1,
    eliteKills: 0,
    depthBossDefeated: false,
    emergencyRecallCompleted: false,
    operationTargetsCleared: 0,
    anomaliesCleared: 0,
    anchorSignalsCleared: 0,
  };
}

export function createIndependentSelectedContract(): SelectedContractState {
  return { kind: 'INDEPENDENT' };
}

export function createDefaultContractBoard(runIndex = 0): ContractBoardState {
  return {
    contracts: [],
    selectedContract: createIndependentSelectedContract(),
    boardRefreshRunIndex: runIndex,
    lastUsedSponsorId: null,
  };
}

export function isSponsorContractSelected(
  selected: SelectedContractState,
): selected is { kind: 'SPONSOR'; contract: GeneratedContract; selectedAtRunIndex: number } {
  return selected.kind === 'SPONSOR';
}

export function getSelectedContractSponsorId(
  selected: SelectedContractState,
): CabalEmployerId | null {
  return selected.kind === 'SPONSOR' ? selected.contract.sponsorId : null;
}

export function freezeContractForRun(
  selected: SelectedContractState,
  runIndex = 0,
): ActiveRunContract {
  if (selected.kind === 'INDEPENDENT') {
    return {
      contractId: null,
      sponsorId: null,
      title: 'Independent Breach',
      objectiveKind: null,
      objectiveText: 'None.',
      validSectorIds: [],
      recommendedSectorIds: [],
      reward: null,
      difficulty: 1,
      selectedAtRunIndex: runIndex,
    };
  }

  const c = selected.contract;
  return {
    contractId: c.id,
    sponsorId: c.sponsorId,
    title: c.title,
    objectiveKind: c.objectiveKind,
    objectiveText: c.objectiveText,
    targetResourceId: c.targetResourceId,
    targetResourceOptions: c.targetResourceOptions,
    targetQuantity: c.targetQuantity,
    targetCategory: c.targetCategory,
    validSectorIds: c.validSectorIds,
    recommendedSectorIds: c.recommendedSectorIds,
    requiredDepth: c.requiredDepth,
    requiresEmergencyRecall: c.requiresEmergencyRecall,
    requiredEliteKills: c.requiredEliteKills,
    requiredOperationTargets: c.requiredOperationTargets,
    bonusObjectiveText: c.bonusObjective?.text,
    bonusObjectiveKind: c.bonusObjective?.kind,
    reward: c.reward,
    bonusReward: c.bonusReward,
    difficulty: c.difficulty,
    minBreachGrade: c.minBreachGrade,
    selectedAtRunIndex: selected.selectedAtRunIndex,
    boundContext: c.boundContext,
  };
}
