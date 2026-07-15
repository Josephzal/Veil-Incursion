import type { ContractObjectiveKind, GeneratedContract } from './contract';
import type { ContractSourceKind } from './contractProcedural';
import type { EncounterModifierId, DeepVeilLawId, VeilDistortionId } from './depthIdentity';
import type { ProceduralAnchorInstance } from './anchorProcedural';
import type { OperationSignalOverlay, StoredOperationInstance } from './operationProcedural';
import type { RunDepth } from './narrativeProcedural';
import type { ResourceItemId } from './resourceItem';
import type {
  CabalEmployerId,
  OperationObjectiveKind,
  OperationState,
  SectorId,
  VeilAnchorType,
} from './worldState';

export type CrisisTheme =
  | 'ANCHOR_BREACH'
  | 'ECHO_OUTBREAK'
  | 'RESOURCE_BLOOM'
  | 'FALSE_EXTRACTION_WAVE'
  | 'RIVAL_SALVAGE_RUSH'
  | 'CONTAINMENT_FAILURE'
  | 'MIRROR_CONTAMINATION'
  | 'UNSTABLE_CARGO_SURGE';

export type ThreatPressureTag =
  | 'ANCHOR'
  | 'ECHO'
  | 'RIVAL'
  | 'EXTRACTION'
  | 'RESOURCE'
  | 'CONTAINMENT'
  | 'MIRROR'
  | 'UNSTABLE';

export type RunWorldBriefTag =
  | CrisisTheme
  | 'PROCEDURAL_ANCHOR'
  | 'PROCEDURAL_OPERATION'
  | 'COMPATIBILITY_BRIEF';

export interface RunScannerOverlayBias {
  anchorSignal: number;
  echoSignal: number;
  operationTarget: number;
  highRisk: number;
  highValueResource: number;
  extraction: number;
  scannerLabelDegrade: number;
  extractionUncertainty: number;
}

export interface RunScannerBias {
  anchorSignalMultiplier: number;
  echoSignalMultiplier: number;
  operationSignalMultiplier: number;
  highRiskMultiplier: number;
  highValueResourceMultiplier: number;
  overlayBias: RunScannerOverlayBias;
}

export interface RunEncounterBias {
  favoredModifiers: Partial<Record<EncounterModifierId, number>>;
  twistedTemplateWeights: Partial<Record<string, number>>;
  rivalMercWeight: number;
  eliteWeight: number;
  unstableCargoWeight: number;
}

export interface RunRewardBias {
  rareLootMultiplier: number;
  sectorResourceMultiplier: number;
  unstableCargoMultiplier: number;
  anchorMarrowMultiplier: number;
  resonantMaterialMultiplier: number;
}

export interface ResourceStress {
  primaryResourceIds: ResourceItemId[];
  secondaryResourceIds: ResourceItemId[];
  highDemandResourceIds: ResourceItemId[];
  unstableResourceIds: ResourceItemId[];
  appraisableCargoIds: ResourceItemId[];
  sourceReasonByResource: Partial<Record<ResourceItemId, string>>;
}

export interface ThreatProfile {
  pressureTags: ThreatPressureTag[];
  rivalPressure: number;
  echoPressure: number;
  anchorPressure: number;
  extractionPressure: number;
  resourcePressure: number;
  containmentPressure: number;
  mirrorPressure: number;
  unstablePressure: number;
  summary: string;
}

export interface SponsorInterestProfile {
  sponsorId: CabalEmployerId;
  interestLevel: number;
  reasonTags: string[];
  preferredResourceIds: ResourceItemId[];
  preferredObjectiveKinds: ContractObjectiveKind[];
  flavorTone: string[];
}

export interface RunWorldBriefDepthBias {
  depth2DistortionWeights: Partial<Record<VeilDistortionId, number>>;
  depth3LawWeights: Partial<Record<DeepVeilLawId, number>>;
}

export interface RunWorldBriefOperationBias {
  preferredObjectiveKinds: OperationObjectiveKind[];
  targetResourceIds: ResourceItemId[];
  targetDepths: RunDepth[];
  targetNodeOverlays: OperationSignalOverlay[];
}

export interface RunWorldBriefContractBias {
  preferredSponsors: CabalEmployerId[];
  preferredObjectiveKinds: ContractObjectiveKind[];
  preferredResourceIds: ResourceItemId[];
  sourceWeights: Partial<Record<ContractSourceKind, number>>;
}

export interface RunWorldBriefGenerationDebug {
  compatibilityBrief?: boolean;
  preliminaryTheme?: CrisisTheme;
  themeWeightTable?: Partial<Record<CrisisTheme, number>>;
  /** Phase 5 aftermath ids applied at deploy. */
  appliedAftermathIds?: string[];
}

export interface ProceduralWorldMemory {
  recentCrisisThemesBySector: Partial<Record<SectorId, CrisisTheme[]>>;
  recentBriefIdsBySector: Partial<Record<SectorId, string[]>>;
  recentResourceStressBySector: Partial<Record<SectorId, ResourceItemId[]>>;
  recentThreatTagsBySector: Partial<Record<SectorId, ThreatPressureTag[]>>;
  recentOperationKindsBySector?: Partial<Record<SectorId, OperationObjectiveKind[]>>;
  recentContractObjectiveKindsBySector?: Partial<Record<SectorId, ContractObjectiveKind[]>>;
}

export const PROCEDURAL_WORLD_MEMORY_DEPTH = 5;

export interface RunWorldBrief {
  id: string;
  seed: string;
  deployRunIndex: number;
  sectorId: SectorId;
  sectorDisplayName: string;
  createdAt: number;

  anchorInstance: ProceduralAnchorInstance | null;
  operationInstance: OperationState;
  operationProcedural?: StoredOperationInstance | null;
  contractBoard: GeneratedContract[];
  selectedContractId: string | null;

  crisisTheme: CrisisTheme;
  crisisDisplayName: string;
  crisisSummary: string;

  resourceStress: ResourceStress;
  threatProfile: ThreatProfile;
  sponsorInterest: SponsorInterestProfile[];

  scannerBias: RunScannerBias;
  encounterBias: RunEncounterBias;
  rewardBias: RunRewardBias;
  depthBias: RunWorldBriefDepthBias;
  operationBias: RunWorldBriefOperationBias;
  contractBias: RunWorldBriefContractBias;

  tags: RunWorldBriefTag[];
  recentMemoryKeys: string[];

  generationDebug?: RunWorldBriefGenerationDebug;
  /** Phase 5 — director metadata attached at deploy. */
  directorMeta?: import('./proceduralDirector').ProceduralDirectorResult;
}

export interface PreliminaryRunWorldContext {
  seed: string;
  deployRunIndex: number;
  sectorId: SectorId;
  sectorDisplayName: string;
  crisisTheme: CrisisTheme;
  crisisDisplayName: string;
  crisisSummary: string;
  resourceStress: ResourceStress;
  threatProfile: ThreatProfile;
  sponsorInterest: SponsorInterestProfile[];
  scannerBias: RunScannerBias;
  encounterBias: RunEncounterBias;
  rewardBias: RunRewardBias;
  depthBias: RunWorldBriefDepthBias;
  operationBias: RunWorldBriefOperationBias;
  contractBias: RunWorldBriefContractBias;
}

export function createEmptyProceduralWorldMemory(): ProceduralWorldMemory {
  return {
    recentCrisisThemesBySector: {},
    recentBriefIdsBySector: {},
    recentResourceStressBySector: {},
    recentThreatTagsBySector: {},
  };
}
