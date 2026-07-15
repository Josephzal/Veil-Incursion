import type { ContractObjectiveKind } from './contract';
import type { RunDepth } from './narrativeProcedural';
import type { ResourceItemId } from './resourceItem';
import type {
  CabalEmployerId,
  EchoActivityLevel,
  OperationObjectiveKind,
  OperationState,
  SectorId,
  VeilAnchorState,
  VeilAnchorType,
} from './worldState';
import type {
  CrisisTheme,
  ResourceStress,
  RunWorldBriefContractBias,
  SponsorInterestProfile,
  ThreatProfile,
} from './runWorldBrief';

export type ContractSourceKind =
  | 'OPERATION_ALIGNED'
  | 'ANCHOR_ALIGNED'
  | 'SECTOR_RESOURCE'
  | 'SPONSOR_PREFERENCE'
  | 'DEPTH_PRESSURE'
  | 'WILDCARD';

export interface ContractBoundContext {
  sectorId?: SectorId;
  operationId?: string;
  operationTitle?: string;
  operationKind?: OperationObjectiveKind;
  anchorType?: VeilAnchorType;
  anchorDisplayName?: string;
  resourceIds?: ResourceItemId[];
  targetDepths?: RunDepth[];
  reason: ContractSourceKind;
}

export interface ContractProceduralMemory {
  recentContractKindsBySponsor: Partial<Record<CabalEmployerId, ContractObjectiveKind[]>>;
  recentContractTitleHashesBySponsor: Partial<Record<CabalEmployerId, string[]>>;
  recentContractResourceIdsBySponsor: Partial<Record<CabalEmployerId, ResourceItemId[]>>;
  recentBoardMemoryKeys: string[];
}

export interface ContractGenerationContext {
  seed: string;
  deployRunIndex: number;
  sectorId: SectorId;
  sectorDisplayName: string;
  sectorResourceFocus: string[];
  hazardLevel: number;
  rewardLevel: number;
  echoActivity: EchoActivityLevel;
  activeOperation: OperationState | null;
  activeAnchor: VeilAnchorState | null;
  recentContractMemory: ContractProceduralMemory;
  /** RunWorldBrief v1 — optional crisis context for board generation. */
  crisisTheme?: CrisisTheme | null;
  resourceStress?: ResourceStress | null;
  threatProfile?: ThreatProfile | null;
  contractBias?: RunWorldBriefContractBias | null;
  sponsorInterest?: SponsorInterestProfile[] | null;
}

export interface ContractGenerationDebug {
  selectedWeightReason?: string;
  sourceWeights?: Partial<Record<ContractSourceKind, number>>;
}

export const CONTRACT_PROCEDURAL_MEMORY_DEPTH = 5;
export const CONTRACT_BOARD_REROLL_ATTEMPTS = 5;
