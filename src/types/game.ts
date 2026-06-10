import type { IncursionInventoryState } from './incursionInventory';
import type { MacroStoryRunConfiguration } from './macroStory';
import type { OutcomeModifierMetric } from './macroStory';
import type { RegionalPresenceState } from './regional';
import type { CargoRunState, GlobalBankedCargo, HarvestReturnRoute } from './cargoGrid';
import { createDefaultBankedCargo } from './cargoGrid';
import type { ResonanceEscalationState } from './resonanceEscalation';
import type { PatrolState } from './overworldPatrol';
import type { AegisLoadout } from './aegisCombat';
import type { CargoItemId } from './cargoGrid';
import type { LeyLineMutationId } from './leyLineMutation';
import { DEFAULT_AEGIS_LOADOUT } from './aegisCombat';
import { createEmptyPatrolState } from './overworldPatrol';
import { createDefaultResonanceEscalationState } from './resonanceEscalation';
import { createDefaultCargoRunState } from './cargoGrid';
import type {
  AttunementState,
  EnvironmentType,
  NodeSectorMeta,
  ResonanceState,
  SectorGraph,
} from './sector';
import { MAX_ATTUNEMENT, STARTING_ATTUNEMENT } from './sector';

export type FactionType = 'TERRAN_GRID' | 'LEGION' | 'SOLARIS';
export type ClassType = 'AEGIS' | 'RIFTSHOT' | 'ENVOY';
export type EncounterType = 'COMBAT' | 'SKILL_CHECK' | 'SANCTUARY';
export type BiomeType = 'HOSPITAL' | 'ALLEYWAYS' | 'SEWERS' | 'CHURCH' | 'FOREST' | 'CANYON';
export type ItemRarity = 'STANDARD' | 'STABILIZED' | 'COBALT' | 'ABYSSAL';
export type CheckStatus = 'NOT_TESTED' | 'SUCCESS' | 'FAILURE';
export type RunNodeType =
  | 'NARRATIVE_EVENT'
  | 'STANDARD_COMBAT'
  | 'ELITE_COMBAT'
  | 'BOSS_COMBAT'
  | 'SANCTUARY'
  | 'BLACK_MARKET'
  | 'EMERGENCY_EXTRACTION'
  | 'SAFE_ANCHOR_EXTRACTION'
  | 'MASTER_EXTRACTION_LINK'
  | 'RESOURCE_HARVEST';

export type ExtractionReviewKind = 'SAFE_ANCHOR' | 'EMERGENCY_RECALL' | 'MASTER_LINK';

export type CombatObjective = 'ERADICATE' | 'SURVIVE_TURNS';

export type EliteCombatModifierId =
  | 'KINETIC_SHIELDING'
  | 'LETHAL_RETALIATION'
  | 'PHASE_SHROUD';
export type IncursionEncounterType =
  | 'COMBAT'
  | 'NARRATIVE_EVENT'
  | 'SANCTUARY'
  | 'BLACK_MARKET'
  | 'RESOURCE_HARVEST';
export type IncursionBiome = 'CITY_STREETS' | 'HOSPITAL' | 'LABORATORY' | 'SECTOR_CORE';
export type IncursionMapMode =
  | 'SCANNING_HUB'
  | 'NODE_ENGAGED'
  | 'PROGRESS_CHECKPOINT'
  | 'SAFEHOUSE_INTERMISSION';

export interface FactionModifiers {
  maxStaminaBonus: number;
  critChanceBonus: number;
  staminaRegenBonus: number;
  calibrationBonus: number;
  maxHpBonus: number;
  damageMitigation: number;
}

export interface PlayerAccount {
  id: string;
  username: string;
  operativeRank: number;
  experiencePoints: number;
  cabalCredits: number;
  alignedFaction: FactionType | null;
  factionPerks: FactionModifiers;
  activeClass: ClassType;
  unlockedClasses: ClassType[];
  unlockedBiomes: BiomeType[];
  progressionMatrix: {
    maxDepthUnlocked: number;
    activeCampaignCluster: 'URBAN' | 'ISOLATED' | 'WILDERNESS' | null;
  };
  regionalPresence: RegionalPresenceState;
  equipment: {
    weaponId: string | null;
    armorId: string | null;
    trinketId: string | null;
  };
  inventory: PlayerInventoryState;
  /** Cabal vault — banked extraction cargo persists across runs. */
  bankedCargo: GlobalBankedCargo;
  /** Pre-run combat deck — four active abilities carried into each incursion. */
  aegisLoadout: AegisLoadout;
}

export interface CombatNodeState {
  currentTurn: number;
  enemyName: string;
  enemyClass: 'GREMLIN' | 'APPARITION' | 'ABOMINATION';
  enemyHp: number;
  enemyMaxHp: number;
  currentEnemyIntent: string;
  abyssalReserve: number;
  eviscerateStored: boolean;
  /** Derived from stamina === 0; EXHAUSTED purged when stamina rises above 0. */
  statusEffects: import('./run').CombatStatusEffect[];
}

export interface WeaponModifiers {
  baseDamageOverride: number;
  staminaCostModifier: number;
  abyssalGainModifier: number;
  parryWindowModifier: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  description: string;
  rarity: ItemRarity;
  type: 'WEAPON' | 'SHROUD' | 'TRINKET';
  modifiers: Partial<WeaponModifiers>;
  isEquipped: boolean;
}

export interface PlayerInventoryState {
  items: InventoryItem[];
  materials: {
    riftIron: number;
    voidFilament: number;
  };
  unopenedCaches: {
    tier1Caches: number;
    tier2Caches: number;
  };
}

export interface NarrativeRunModifiers {
  nextCombatEnemyHpBonusPct: number;
  nextCombatDamageBonusPct: number;
  bossArmorPiercePct: number;
  nodeNineCalibrationBonusPct: number;
  bossShieldBypassPct: number;
}

export interface IncursionProgressState {
  collectedFlags: string[];
  usedNarrativeEventIds: string[];
  narrativeModifiers: NarrativeRunModifiers;
  outcomeModifiers: OutcomeModifierMetric[];
  pendingCombatAmbush: boolean;
  forceNextSanctuary: boolean;
  macroStory: MacroStoryRunConfiguration;
}

export function createDefaultNarrativeRunModifiers(): NarrativeRunModifiers {
  return {
    nextCombatEnemyHpBonusPct: 0,
    nextCombatDamageBonusPct: 0,
    bossArmorPiercePct: 0,
    nodeNineCalibrationBonusPct: 0,
    bossShieldBypassPct: 0,
  };
}

export function createDefaultIncursionProgressState(): IncursionProgressState {
  return {
    collectedFlags: [],
    usedNarrativeEventIds: [],
    narrativeModifiers: createDefaultNarrativeRunModifiers(),
    outcomeModifiers: [],
    pendingCombatAmbush: false,
    forceNextSanctuary: false,
    macroStory: { runMode: 'STANDALONE', macroStoryId: null },
  };
}

export interface NarrativeChoiceEffectPreview {
  onSuccess?: string;
  onFailure?: string;
  guaranteed?: string;
}

export interface NarrativeEventNode {
  id: string;
  matrixEventId?: string;
  interactionMode?: 'standard' | 'conditional';
  /** Open-sector environment flavor for narrative presentation. */
  environmentType?: import('./sector').EnvironmentType;
  title: string;
  scenarioText: string;
  choiceA: {
    label: string;
    requirement: string;
    successText: string;
    failureText: string;
    effectPreview?: NarrativeChoiceEffectPreview;
  };
  choiceB: {
    label: string;
    requirement: string;
    successText: string;
    failureText: string;
    effectPreview?: NarrativeChoiceEffectPreview;
    locked?: boolean;
    lockReason?: string;
  };
}

export interface EnvironmentalModifiers {
  isEnemyPhaseShrouded: boolean;
  isPlayerBlinded: boolean;
  hasTetanusGlitch: boolean;
  startingStaminaPenalty: number;
  environmentType?: EnvironmentType;
  meleeDamageBonusPct?: number;
  staminaCostReductionPct?: number;
  parryWindowBonusPct?: number;
  resonancePercent?: number;
  bloodFrenzyActive?: boolean;
  combatObjective?: CombatObjective;
  survivalTurnsRequired?: number;
  enemyDamageReductionPct?: number;
  lethalRetaliationDamage?: number;
  eliteModifier?: EliteCombatModifierId;
}

export interface IncursionNode {
  id: string;
  encounterIndex: number;
  /** Legacy alias — always equals encounterIndex. */
  index: number;
  encounterType: IncursionEncounterType;
  biome: IncursionBiome;
  /** Resolved routing type for encounter screens. */
  type: RunNodeType;
  label: string;
  isCompleted: boolean;
  /** Boss terminal node — bypasses manual sweep mechanics. */
  isPreDiscovered?: boolean;
  environmentType?: EnvironmentType;
  sectorMeta?: NodeSectorMeta;
  isExtractionNode?: boolean;
  isAnomalyNest?: boolean;
  safeAnchorIndex?: 1 | 2 | 3;
}

export interface BossPhaseConfiguration {
  phaseNumber: number;
  phaseName: string;
  triggerHpThreshold: number;
  intentModifier: string;
}

export type DistrictBossVariant = 'STANDARD' | 'SHARED_CHOIR';

export interface BossRuntimeProfile {
  name: string;
  maxHp: number;
  currentHp: number;
  currentPhase: number;
  phases: BossPhaseConfiguration[];
  depth: number;
  variant?: DistrictBossVariant;
  bodyCount?: number;
}

export interface ActiveIncursionState {
  environmentalModifiers: EnvironmentalModifiers;
  /** Run-scoped consumables — separate from hub inventory manifest. */
  inventory: IncursionInventoryState;
  progress: IncursionProgressState;
  currentNarrativeId: string | null;
  lastCheckStatus: CheckStatus;
  activeChoice: 'A' | 'B' | null;
  /** Player-facing depth (1–30); kept in sync with nodesCleared + 1. */
  currentDepth: number;
  /** Active district chapter (1–3), derived from currentDepth. */
  currentDistrict: 1 | 2 | 3;
  /** Rift node ids that already triggered a manifest scan penalty. */
  resonanceManifestNodeIds: readonly string[];
  currentEncounterIndex: number;
  /** Resolved path — one chosen node per cleared encounter step. */
  encounterPath: IncursionNode[];
  /** @deprecated Sector graph replaces pre-generated depth clusters. */
  encounterOptionClusters: IncursionNode[][];
  /** @deprecated */
  earlySanctuarySpawned: boolean;
  selectedVectorId: string | null;
  /** Node staged for scan confirmation overlay preview. */
  previewNodeId: string | null;
  scanConfirmOverlayVisible: boolean;
  isRunActive: boolean;
  bossProfile: BossRuntimeProfile | null;
  mapMode: IncursionMapMode;
  lastCheckpointMessage: string | null;
  /** Run-scoped credits earned from combat — reset each run, not carried to hub. */
  runCredits: number;
  sectorGraph: SectorGraph;
  currentNodeId: string;
  nodesCleared: number;
  attunement: AttunementState;
  resonance: ResonanceState;
  patrolState: PatrolState;
  /** Four active combat abilities locked at Safehouse. */
  aegisLoadout: AegisLoadout;
  /** Ley-Line mutations acquired this run — stack and alter combat behavior. */
  leyLineMutations: LeyLineMutationId[];
  /** Current black market node stock (soul-core + 2–4 rotating listings). */
  blackMarketStock: CargoItemId[];
  focusedNodeIds: string[];
  bossDefeated: boolean;
  primeExtractionBonus: boolean;
  sectorTier: number;
  cargo: CargoRunState;
  pendingHarvestReturn: HarvestReturnRoute | null;
  resonanceEscalations: ResonanceEscalationState;
  /** Safe anchor extractions used this run (1, 2, 3). */
  clearedSafeAnchors: readonly number[];
  collapseActive: boolean;
  pendingSafeAnchorIndex: 1 | 2 | 3 | null;
  extractionReviewKind: ExtractionReviewKind | null;
  masterLinkUsed: boolean;
  defendRiftActive: boolean;
}

export function createDefaultEnvironmentalModifiers(): EnvironmentalModifiers {
  return {
    isEnemyPhaseShrouded: false,
    isPlayerBlinded: false,
    hasTetanusGlitch: false,
    startingStaminaPenalty: 0,
  };
}

export function createDefaultActiveIncursionState(): ActiveIncursionState {
  return {
    environmentalModifiers: createDefaultEnvironmentalModifiers(),
    inventory: { items: [] },
    progress: createDefaultIncursionProgressState(),
    currentNarrativeId: null,
    lastCheckStatus: 'NOT_TESTED',
    activeChoice: null,
    currentDepth: 1,
    currentDistrict: 1,
    resonanceManifestNodeIds: [],
    currentEncounterIndex: 0,
    encounterPath: [],
    encounterOptionClusters: [],
    earlySanctuarySpawned: false,
    selectedVectorId: null,
    previewNodeId: null,
    scanConfirmOverlayVisible: false,
    isRunActive: false,
    bossProfile: null,
    mapMode: 'SCANNING_HUB',
    lastCheckpointMessage: null,
    runCredits: 0,
    sectorGraph: { entryId: '', nodes: {}, sectorTier: 1, maxGraphDepth: 30 },
    currentNodeId: '',
    nodesCleared: 0,
    attunement: { current: STARTING_ATTUNEMENT, max: MAX_ATTUNEMENT },
    resonance: { percent: 0 },
    patrolState: createEmptyPatrolState(),
    aegisLoadout: [...DEFAULT_AEGIS_LOADOUT],
    leyLineMutations: [],
    blackMarketStock: [],
    focusedNodeIds: [],
    bossDefeated: false,
    primeExtractionBonus: false,
    sectorTier: 1,
    cargo: createDefaultCargoRunState(),
    pendingHarvestReturn: null,
    resonanceEscalations: createDefaultResonanceEscalationState(),
    clearedSafeAnchors: [],
    collapseActive: false,
    pendingSafeAnchorIndex: null,
    extractionReviewKind: null,
    masterLinkUsed: false,
    defendRiftActive: false,
  };
}
