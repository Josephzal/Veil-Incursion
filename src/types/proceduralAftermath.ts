import type { ResourceItemId } from './resourceItem';
import type {
  CrisisTheme,
  RunEncounterBias,
  RunRewardBias,
  RunScannerBias,
  RunWorldBrief,
  RunWorldBriefContractBias,
  RunWorldBriefOperationBias,
  ThreatProfile,
} from './runWorldBrief';
import type {
  OperationObjectiveKind,
  SectorId,
  VeilAnchorState,
  VeilAnchorType,
  WorldStatePersistedState,
} from './worldState';

export type SectorAftermathType =
  | 'ANCHOR_PRESSURE_REDUCED'
  | 'ECHO_ACTIVITY_QUIETED'
  | 'RESOURCE_VEINS_EXPOSED'
  | 'ROUTES_STABILIZED'
  | 'DIRTY_WAKE'
  | 'UNSTABLE_SCENT'
  | 'CONTAINMENT_LEAK'
  | 'RIVAL_ATTENTION'
  | 'ELITE_SUPPRESSION'
  | 'OPERATION_MOMENTUM'
  | 'SECTOR_FATIGUE';

export type SectorAftermathTag =
  | 'ANCHOR'
  | 'ECHO'
  | 'RESOURCE'
  | 'EXTRACTION'
  | 'RIVAL'
  | 'UNSTABLE'
  | 'CONTAINMENT'
  | 'ELITE'
  | 'OPERATION'
  | 'MARKET';

export type SectorAftermathSource =
  | 'OPERATION_COMPLETED'
  | 'ANCHOR_SUPPRESSED'
  | 'ANCHOR_SIGNAL_CLEARED'
  | 'ECHO_NODE_RESOLVED'
  | 'ECHO_RECOVERY_COMPLETED'
  | 'RESOURCE_BLOOM_HARVESTED'
  | 'RESOURCE_BLOOM_OVERHARVESTED'
  | 'RESOURCE_BLOOM_STABILIZED'
  | 'FALSE_EXTRACTION_STABILIZED'
  | 'FALSE_EXTRACTION_SURVIVED'
  | 'DIRTY_EXTRACTION_USED'
  | 'DIRTY_EXTRACTION_CHAINED'
  | 'UNSTABLE_CARGO_EXTRACTED'
  | 'CONTRABAND_EXTRACTED'
  | 'BOSS_SUPPRESSED'
  | 'ELITE_SUPPRESSED'
  | 'CONTRACT_COMPLETED'
  | 'HIGH_RISK_CLEARED';

export type AftermathStackMode = 'refresh' | 'intensify';

export interface AftermathScannerBiasDelta {
  anchorSignalMultiplier?: number;
  echoSignalMultiplier?: number;
  operationSignalMultiplier?: number;
  highRiskMultiplier?: number;
  highValueResourceMultiplier?: number;
  overlayBias?: Partial<RunScannerBias['overlayBias']>;
}

export interface SectorAftermathModifier {
  id: string;
  sectorId: SectorId;
  type: SectorAftermathType;
  source: SectorAftermathSource;
  displayName: string;
  description: string;
  createdAtRunIndex: number;
  durationRuns: number;
  remainingRuns: number;
  intensity: 1 | 2 | 3;
  tags: SectorAftermathTag[];
  stackKey: string;
  stackMode: AftermathStackMode;
  scannerBiasDelta?: AftermathScannerBiasDelta;
  encounterBiasDelta?: Partial<RunEncounterBias> & {
    favoredModifiers?: RunEncounterBias['favoredModifiers'];
    twistedTemplateWeights?: RunEncounterBias['twistedTemplateWeights'];
  };
  rewardBiasDelta?: Partial<RunRewardBias>;
  contractBiasDelta?: Partial<RunWorldBriefContractBias>;
  operationBiasDelta?: Partial<RunWorldBriefOperationBias>;
  threatProfileDelta?: Partial<ThreatProfile>;
  affectedResourceIds?: ResourceItemId[];
  affectedAnchorType?: VeilAnchorType;
  affectedOperationKind?: OperationObjectiveKind;
  affectedCrisisThemes?: CrisisTheme[];
  expiresSilently?: boolean;
  generationDebug?: {
    triggeringEvents?: string[];
    appliedRules?: string[];
  };
}

export interface RunAftermathInput {
  sectorId: SectorId;
  deployRunIndex: number;
  runId: string;

  runCompleted: boolean;
  extracted: boolean;
  died: boolean;

  activeRunWorldBrief?: RunWorldBrief | null;
  activeAnchor?: VeilAnchorState | null;
  completedOperationKind?: OperationObjectiveKind;

  operationCompleted?: boolean;
  operationProgressGained?: number;

  anchorSuppressed?: boolean;
  anchorSignalsCleared?: number;
  anchorCoreBreachesCleared?: number;
  anchorMarrowExtracted?: number;

  echoNodesResolved?: number;
  hostileEchoesDefeated?: number;
  mirrorCombatsCleared?: number;
  resonantFilamentExtracted?: number;

  resourceBloomsCleared?: number;
  resourceBloomsOverharvested?: number;
  resourceBloomsStabilized?: number;

  falseExtractionsStabilized?: number;
  falseExtractionsSurvived?: number;

  dirtyExtractionsUsed?: number;
  safeExtractionsUsed?: number;
  emergencyRecallUsed?: boolean;

  unstableCargoExtracted?: number;
  contrabandExtracted?: number;
  appraisableCargoExtracted?: number;

  elitesDefeated?: number;
  bossesDefeated?: number;
  highRiskNodesCleared?: number;

  contractCompleted?: boolean;
  resourceStressMatched?: boolean;
}

export interface AftermathGenerationResult {
  created: SectorAftermathModifier[];
  refreshed: SectorAftermathModifier[];
  removedByCap: SectorAftermathModifier[];
  runId: string;
}

export interface AftermathDebriefLine {
  kind: 'new' | 'refreshed' | 'expired';
  displayName: string;
  description: string;
  remainingRuns: number;
  intensity: 1 | 2 | 3;
}

export const MAX_SECTOR_AFTERMATH_MODIFIERS = 3;

export interface WorldStateAftermathMeta {
  /** Idempotency — last run key that generated aftermath. */
  lastAftermathRunId?: string;
}

export type WorldStateWithAftermath = WorldStatePersistedState & {
  sectorAftermathModifiersBySector?: Partial<Record<SectorId, SectorAftermathModifier[]>>;
  aftermathMeta?: WorldStateAftermathMeta;
};
