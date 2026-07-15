import type { ContractObjectiveKind } from './contract';
import type { EncounterModifierId } from './depthIdentity';
import type { DeepVeilLawId, VeilDistortionId } from './depthIdentity';
import type { ResourceItemId } from './resourceItem';
import type {
  OperationObjectiveKind,
  SectorId,
  VeilAnchorType,
} from './worldState';

export type AnchorLifecycleState =
  | 'ACTIVE'
  | 'SUPPRESSED'
  | 'DORMANT'
  | 'ROTATING_OUT';

export type AnchorInstanceModifier =
  | 'FRACTURED'
  | 'ECHOING'
  | 'BLOOMING'
  | 'LEAKING'
  | 'INVERTED'
  | 'STARVED'
  | 'OVERFED'
  | 'FORTIFIED'
  | 'RAVENOUS';

export type AnchorPressureTag =
  | 'ECHO_CONTAMINATION'
  | 'ANCHOR_SIGNALS'
  | 'RESONANT_MATERIALS'
  | 'RESOURCE_BLOOM'
  | 'HIGH_VALUE_CARGO'
  | 'EXTRACTION_INSTABILITY'
  | 'SCANNER_DEGRADATION'
  | 'RITUAL_PRESSURE'
  | 'ELITE_PRESSURE'
  | 'GEOMETRY_FOLD';

export interface AnchorScannerBias {
  anchorSignalMultiplier: number;
  echoSignalMultiplier: number;
  operationSignalMultiplier: number;
  highRiskMultiplier: number;
  highValueResourceMultiplier: number;
  extractionUncertainty: number;
  scannerLabelDegradeChance: number;
}

export interface AnchorEncounterBias {
  favoredModifiers: Partial<Record<EncounterModifierId, number>>;
  twistedTemplateWeights: Partial<Record<string, number>>;
}

export interface WeightedAnchorPoolEntry {
  type: VeilAnchorType;
  weight: number;
}

export interface DormantAnchorRecord {
  type: VeilAnchorType;
  displayName: string;
  instanceId: string;
  remainingRuns: number;
  suppressedAtRunIndex: number;
}

export interface ProceduralAnchorInstance {
  id: string;
  sectorId: SectorId;
  type: VeilAnchorType;
  displayName: string;
  baseDisplayName: string;
  modifier: AnchorInstanceModifier | null;
  generationSeed: string;
  createdAtRunIndex: number;
  createdAtOperationIndex?: number;
  lifecycleState: AnchorLifecycleState;
  dormantRunsRemaining?: number;
  suppressedAtRunIndex?: number | null;
  pressureLevel: number;
  resourceBias: ResourceItemId[];
  pressureTags: AnchorPressureTag[];
  operationBias: OperationObjectiveKind[];
  contractBias?: ContractObjectiveKind[];
  scannerBias: AnchorScannerBias;
  encounterBias: AnchorEncounterBias;
  depth2DistortionBias?: Partial<Record<VeilDistortionId, number>>;
  depth3LawBias?: Partial<Record<DeepVeilLawId, number>>;
  titleFlavorTags: string[];
  recentMemoryKey: string;
}

export interface SectorAnchorState {
  activeAnchorInstance: ProceduralAnchorInstance;
  recentAnchorTypes: VeilAnchorType[];
  recentAnchorModifiers: (AnchorInstanceModifier | null)[];
  recentDisplayNameHashes: string[];
  dormantAnchors: DormantAnchorRecord[];
  anchorRotationIndex: number;
  lastRotatedRunIndex: number;
}

export interface AnchorGenerationContext {
  seed: string;
  deployRunIndex: number;
  sectorId: SectorId;
  sectorDisplayName: string;
  anchorPool: WeightedAnchorPoolEntry[];
  recentAnchorTypes: VeilAnchorType[];
  recentAnchorModifiers: (AnchorInstanceModifier | null)[];
  recentDisplayNameHashes: string[];
  dormantAnchors: DormantAnchorRecord[];
  rotationIndex: number;
  currentOperationKind?: OperationObjectiveKind | null;
  sectorResourceFocus?: string[];
  hazardLevel?: number;
  rewardLevel?: number;
  echoActivity?: 'LOW' | 'ELEVATED' | 'CRITICAL';
}

export const ANCHOR_PROCEDURAL_MEMORY_DEPTH = 3;
