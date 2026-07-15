import type { CrisisTheme } from './runWorldBrief';
import type { RunDepth } from './narrativeProcedural';
import type { ResourceItemId } from './resourceItem';
import type {
  OperationCompletionEffect,
  OperationContributionRules,
  OperationObjectiveKind,
  RewardEmphasis,
  SectorId,
  VeilAnchorType,
} from './worldState';

export type OperationEnemyRole =
  | 'ELITE'
  | 'BOSS'
  | 'ARTILLERY'
  | 'SUPPORT'
  | 'ANCHOR_TAGGED'
  | 'DEPTH_3_EXCLUSIVE';

export type OperationSignalOverlay =
  | 'ANCHOR_SIGNAL'
  | 'ECHO_SIGNAL'
  | 'OPERATION_TARGET'
  | 'HIGH_RISK_ZONE'
  | 'HIGH_VALUE_RESOURCE'
  | 'EXTRACTION';

export type OperationBonusRequirementKind =
  | 'CLEAR_ANCHOR_SIGNAL_DEPTH_2'
  | 'EXTRACT_TARGET_RESOURCE'
  | 'CLEAR_HIGH_RISK'
  | 'COMPLETE_DIRTY_EXTRACTION'
  | 'AVOID_DIRTY_EXTRACTION'
  | 'DEFEAT_ELITE'
  | 'CLEAR_ECHO_RESIDUE'
  | 'STABILIZE_FALSE_EXTRACTION'
  | 'CLEAR_RESOURCE_BLOOM'
  | 'DEFEAT_DEPTH_BOSS'
  | 'DEFEAT_ANCHOR_ELITE';

export interface OperationBonusRequirement {
  kind: OperationBonusRequirementKind;
  targetDepth?: RunDepth;
  targetQuantity?: number;
}

export interface OperationBonusReward {
  credits?: number;
  reputation?: number;
  operationProgress?: number;
  rewardEmphasisBoost?: Partial<RewardEmphasis>;
  debriefCallout?: string;
}

export interface OperationBonusObjective {
  id: string;
  description: string;
  requirement: OperationBonusRequirement;
  reward: OperationBonusReward;
  completed: boolean;
}

export interface OperationAftermathEffect {
  summary: string;
  metadataOnly?: boolean;
}

/** Rolling memory per sector — prevents obvious procedural repeats. */
export interface OperationProceduralMemoryEntry {
  operationIndex: number;
  objectiveKind: OperationObjectiveKind;
  titleHash: string;
  targetResourceIds: ResourceItemId[];
  targetAnchorType: VeilAnchorType | null;
  completedAtRunIndex?: number;
}

export interface OperationProceduralMemory {
  recent: OperationProceduralMemoryEntry[];
  staticTitleHashes: string[];
}

export interface OperationGenerationContext {
  seed: string;
  deployRunIndex: number;
  sectorId: SectorId;
  operationIndex: number;
  sectorDisplayName: string;
  sectorResourceFocus: string[];
  hazardLevel: number;
  rewardLevel: number;
  echoActivity: 'LOW' | 'ELEVATED' | 'CRITICAL';
  activeAnchorType: VeilAnchorType | null;
  activeAnchorDisplayName: string | null;
  activeAnchorId?: string | null;
  anchorResourceBias: string[];
  anchorModifier?: import('./anchorProcedural').AnchorInstanceModifier | null;
  anchorOperationBias?: OperationObjectiveKind[];
  recentOperationMemory: OperationProceduralMemory;
  /** RunWorldBrief v1 — optional crisis context for new procedural operations. */
  crisisTheme?: CrisisTheme | null;
  preferredObjectiveKinds?: OperationObjectiveKind[];
  preferredResourceIds?: ResourceItemId[];
}

/** Procedural fields stored on generated operation instances. */
export interface ProceduralOperationFields {
  procedural: boolean;
  generationSeed: string;
  operationIndex: number;
  createdAtRunIndex: number;
  targetAnchorType?: VeilAnchorType | null;
  targetAnchorDisplayName?: string | null;
  targetResourceIds: ResourceItemId[];
  targetDepths: RunDepth[];
  targetEnemyRoles: OperationEnemyRole[];
  targetNodeOverlays: OperationSignalOverlay[];
  progressRequired: number;
  contributionRules: OperationContributionRules;
  bonusObjectives: OperationBonusObjective[];
  completionEffect: OperationCompletionEffect;
  completionEffectSummary: string;
  aftermathEffect?: OperationAftermathEffect;
  operationTags: string[];
  titleHash: string;
  recentMemoryKey: string;
}

/** Persisted operation instance — mirrors SectorOperationTemplate for world state storage. */
export interface StoredOperationInstance {
  id: string;
  title: string;
  description: string;
  objectiveKind: import('./worldState').OperationObjectiveKind;
  rewardEmphasis: import('./worldState').RewardEmphasis;
  procedural?: boolean;
  generationSeed?: string;
  operationIndex?: number;
  createdAtRunIndex?: number;
  targetAnchorType?: import('./worldState').VeilAnchorType | null;
  targetAnchorDisplayName?: string | null;
  targetResourceIds?: ResourceItemId[];
  targetDepths?: RunDepth[];
  targetEnemyRoles?: OperationEnemyRole[];
  targetNodeOverlays?: OperationSignalOverlay[];
  progressRequired?: number;
  contributionRules?: import('./worldState').OperationContributionRules;
  bonusObjectives?: OperationBonusObjective[];
  completionEffect?: import('./worldState').OperationCompletionEffect;
  completionEffectSummary?: string;
  operationTags?: string[];
  titleHash?: string;
  recentMemoryKey?: string;
}

export const USE_PROCEDURAL_OPERATIONS_FROM_START = false;

export const OPERATION_PROCEDURAL_MEMORY_DEPTH = 5;
