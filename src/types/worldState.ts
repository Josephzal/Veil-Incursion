import type {
  ActiveRunContract,
  ContractBoardState,
  SelectedContractState,
} from './contract';
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
  emergencyRecallExtraction?: number;
  bankAtSafehouse?: number;
  defeatElite?: number;
  clearOperationTarget?: number;
}

export type OperationLifecycleStatus = 'ACTIVE' | 'COMPLETED' | 'AFTERMATH' | 'EXPIRED';

export interface SectorOperationLifecycle {
  operationId: string;
  status: OperationLifecycleStatus;
  runsSinceActivation: number;
  maxRunsActive: number;
  aftermathRunsRemaining: number;
  /** Deploy run index when this operation instance was generated. */
  generatedAtRunIndex: number;
  /** Deploy run index when this operation expires if not completed. */
  expiresAtRunIndex: number;
  /** Deploy run index when the operation was completed, if applicable. */
  completedAtRunIndex?: number;
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
  lifecycleStatus: OperationLifecycleStatus;
  runsRemaining: number;
  generatedAtRunIndex: number;
  expiresAtRunIndex: number;
  rewardPreview: string;
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
  /** Sponsor from selected contract — not a player allegiance lock. */
  employerCabal: CabalEmployerId | null;
  activeContract: ActiveRunContract;
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
  /** Scanner-facing label — set at overlay roll. */
  echoSignalLabel?: string;
  /** Resolved at engagement — kind picks narrative vs combat path. */
  echoEncounterKind?: import('./echoEncounter').EchoEncounterKind;
  /** Hostile echo combat template — set at engagement for HOSTILE_ECHO. */
  echoTemplateId?: string;
  echoTier?: 'STANDARD' | 'LEGENDARY';
  /** Future player snapshot hook — authored echoes only in v1. */
  echoSnapshot?: import('./echoEncounter').EchoSnapshotPlaceholder;
  operationTag?: OperationObjectiveKind;
  highRisk?: boolean;
  highValueResource?: boolean;
  /** Dead-Drop Receiver — buried cache with elevated risk. */
  keepsakeDeadDrop?: boolean;
  /** Choir Tuning Fork — harmonized operation + resource signal. */
  keepsakeHarmonic?: boolean;
  /** Black Market Mark — corrupted future vector after marked purchase. */
  keepsakeMarkedCorruption?: boolean;
  /** Hollow Keyring — occult lock requiring a Hollow Key to unlock options. */
  keepsakeOccultLock?: boolean;
  /** Bloodhound Tag — tagged rival/elite quarry node. */
  keepsakeTaggedQuarry?: boolean;
  /** False Evac Beacon — decoy/lure/scramble beacon planted on route. */
  keepsakeFalseBeacon?: boolean;
  /** Mirror Writ — mirrored side-objective node. */
  keepsakeMirrored?: boolean;
  /** Depth identity encounter modifier — one per node max. */
  encounterModifier?: import('./depthIdentity').EncounterModifierId;
  /** Player-facing telegraph for the encounter modifier. */
  encounterModifierLabel?: string;
  encounterModifierSummary?: string;
  /** Depth 2 twisted encounter template — one per node max. */
  twistedTemplate?: import('./depthIdentity').TwistedTemplateId;
  twistedTemplateLabel?: string;
  twistedTemplateSummary?: string;
  /** Phase F — scanner label certainty for this node. */
  scannerLabelCertainty?: 'RELIABLE' | 'DEGRADED' | 'STRANGE';
  scannerDisplayedNodeType?: import('./proceduralRunTree').ProceduralNodeType;
  scannerStrangeLabel?: string;
  scannerLabelCorrupt?: boolean;
  /** Phase B — composition / readability telegraph (stamped at engage). */
  compositionTemplateId?: import('./encounterComposition').EncounterCompositionTemplateId;
  compositionRiskLabel?: import('./encounterComposition').EncounterRiskLabel;
  compositionRewardTier?: import('./encounterComposition').EncounterRewardTier;
  compositionRolePreview?: readonly import('./encounterComposition').CompositionEnemyRole[];
  compositionRewardPreview?: string;
  compositionWarningSummary?: string;
}

/** Tracks per-run caps while lazily rolling node context at engagement. */
export interface NodeModifierRollState {
  echoSignalsUsed: number;
  legendaryEchoUsed: number;
  /** Procedural tree depth (1–15) → echo overlays placed this run. */
  echoSignalsByDepth: Record<number, number>;
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

export interface SectorOperationTemplateSnapshot {
  id: string;
  title: string;
  description: string;
  objectiveKind: OperationObjectiveKind;
  rewardEmphasis: RewardEmphasis;
}

export interface WorldStatePersistedState {
  selectedSectorId: SectorId;
  contractBoard: ContractBoardState;
  /** Monotonic counter — used for contract refresh and selection timestamps. */
  deployRunIndex: number;
  operationProgress: Record<string, number>;
  /** Rotating operation queue index per sector. */
  activeOperationIndex: Partial<Record<SectorId, number>>;
  temporarySectorModifiers: TemporarySectorModifier[];
  dormantAnchorRuns: Record<string, number>;
  operationLog: string[];
  /** Per-sector operation lifecycle (expiration, aftermath). */
  sectorOperationLifecycle: Partial<Record<SectorId, SectorOperationLifecycle>>;
  /** Dev-only forced operation templates — stripped before AsyncStorage persistence. */
  sectorOperationOverrides?: Partial<Record<SectorId, SectorOperationTemplateSnapshot>>;
  version: 2;
}

/** Combat-facing snapshot derived from RunGenerationContext at run start. */
export interface RunModifierSnapshot {
  maxHpBonusPct: number;
  kineticArmorBonus: number;
  rareLootBonusPct: number;
  blackMarketDiscountPct: number;
  firstTurnApBonus: number;
}
