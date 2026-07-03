import type { FactionType } from './game';
import type { VeilBiome } from './encounterSpawn';

/** Reuse existing sector IDs from the regional map catalog. */
export type SectorId =
  | 'THE_SLAG_WORKS'
  | 'THE_ABYSSAL_SINK'
  | 'THE_NULL_ZONE'
  | 'THE_BLACKLINE_TERMINUS'
  | 'THE_ASHEN_WASTES';

export type DepthStage = 'THRESHOLD' | 'BREACH' | 'DEEP_VEIL';

export type AnchorStage = 'TRACE' | 'BREACH' | 'CORE';

export type NodePressureBand = 'LOW' | 'MEDIUM' | 'HIGH';

export type VeilAnchorType =
  | 'CHOIR_SPIRE'
  | 'LEY_NEXUS'
  | 'NULL_MONOLITH'
  | 'RIFT_ENGINE'
  | 'ASHEN_HEART';

export type OperationObjectiveKind =
  | 'ANCHOR_ASSAULT'
  | 'ECHO_RECOVERY'
  | 'EXTRACTION_SURGE'
  | 'RESOURCE_SURVEY'
  | 'BOSS_SUPPRESSION';

/** Cabal employers / sponsors — not sector controllers. */
export type CabalEmployerId = FactionType;

export type EchoActivityLevel = 'LOW' | 'ELEVATED' | 'CRITICAL';

export interface AnchorRealityRules {
  combatBias: number;
  eliteBias: number;
  anomalyBias: number;
  echoBias: number;
  lootBias: number;
  extractionRiskBias: number;
}

export interface VeilAnchorState {
  id: string;
  sectorId: SectorId;
  type: VeilAnchorType;
  displayName: string;
  description: string;
  isActive: boolean;
  realityRules: AnchorRealityRules;
}

export interface OperationContributionRules {
  defeatAnchorElite?: number;
  clearAnchorCore?: number;
  defeatEcho?: number;
  extractTargetResource?: number;
  defeatDepthBoss?: number;
  successfulExtraction?: number;
}

export interface RewardEmphasis {
  credits?: number;
  rareLoot?: number;
  echoCores?: number;
  targetResources?: string[];
}

export interface OperationState {
  id: string;
  sectorId: SectorId;
  title: string;
  description: string;
  objectiveKind: OperationObjectiveKind;
  linkedAnchorId?: string;
  progressCurrent: number;
  progressRequired: number;
  rewardEmphasis: RewardEmphasis;
  contributionRules: OperationContributionRules;
}

export interface DepthStageModifiers {
  combatBias: number;
  eliteBias: number;
  anomalyBias: number;
  echoBias: number;
  anchorSignalChance: number;
  rareLootBias: number;
}

export interface SectorState {
  id: SectorId;
  displayName: string;
  /** Player-facing flavor string from sector catalog. */
  biome: string;
  /** Encounter spawn biome — locked for the run from Veil Front sector selection. */
  veilBiome: VeilBiome;
  hazardLevel: number;
  rewardLevel: number;
  resourceFocus: string[];
  activeAnchor: VeilAnchorState | null;
  activeOperation: OperationState;
  echoActivity: EchoActivityLevel;
  /** Flavor / UI only — never percentages or control metrics. */
  employerPresence?: CabalEmployerId[];
}

export interface RewardModifiers {
  creditBonusPct: number;
  rareLootBonusPct: number;
  blackMarketDiscountPct: number;
  maxHpBonusPct: number;
}

export interface EncounterBias {
  combatWeightDelta: number;
  eliteWeightDelta: number;
  anomalyWeightDelta: number;
  echoWeightDelta: number;
}

export interface ScannerSignalBias {
  anchorSignalMultiplier: number;
  echoSignalMultiplier: number;
  operationSignalMultiplier: number;
  highRiskMultiplier: number;
}

/** Static for the entire run — no depthStage here. */
export interface RunGenerationContext {
  sectorState: SectorState;
  activeOperation: OperationState;
  activeAnchor: VeilAnchorState | null;
  employerCabal: CabalEmployerId | null;
  rewardModifiers: RewardModifiers;
  encounterBias: EncounterBias;
  scannerSignalBias: ScannerSignalBias;
}

/** Computed per macro depth / node during generation or combat. */
export interface DepthGenerationContext {
  depthStage: DepthStage;
  depthIndex: 1 | 2 | 3;
  nodeIndexWithinDepth: number;
  depthStageModifiers: DepthStageModifiers;
}

export interface NodeContextModifiers {
  depthStage: DepthStage;
  nodePressureBand: NodePressureBand;
  anchorSignal?: boolean;
  anchorStage?: AnchorStage;
  echoSignal?: boolean;
  echoTemplateId?: string;
  echoTier?: 'STANDARD' | 'LEGENDARY';
  operationTag?: OperationObjectiveKind;
  highRisk?: boolean;
  highValueResource?: boolean;
}

export interface OperationCompletionEffect {
  deactivateAnchorForRuns?: number;
  unlockTemporarySectorModifier?: string;
  unlockResourceFocus?: string;
  increaseRewardLevelForRuns?: number;
  rotateToNextOperation?: boolean;
}

export interface TemporarySectorModifier {
  sectorId: SectorId;
  rewardLevelBoost: number;
  runsRemaining: number;
  label: string;
}

export interface WorldStatePersistedState {
  selectedSectorId: SectorId;
  selectedEmployerCabal: CabalEmployerId | null;
  operationProgress: Record<string, number>;
  /** Rotating operation queue index per sector. */
  activeOperationIndex: Partial<Record<SectorId, number>>;
  temporarySectorModifiers: TemporarySectorModifier[];
  dormantAnchorRuns: Record<string, number>;
  operationLog: string[];
  version: 1;
}

/** Combat-facing snapshot derived from RunGenerationContext at run start. */
export interface RunModifierSnapshot {
  maxHpBonusPct: number;
  kineticArmorBonus: number;
  rareLootBonusPct: number;
  blackMarketDiscountPct: number;
  firstTurnApBonus: number;
}
