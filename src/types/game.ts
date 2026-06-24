import type { IncursionInventoryState } from './incursionInventory';
import type { MacroStoryRunConfiguration } from './macroStory';
import type { OutcomeModifierMetric } from './macroStory';
import type { RegionalPresenceState } from './regional';
import type { CargoItemId, CargoRunState, GlobalBankedCargo, HarvestReturnRoute } from './cargoGrid';
import { createDefaultBankedCargo } from './cargoGrid';
import type { ResonanceEscalationState } from './resonanceEscalation';
import type { PatrolState } from './overworldPatrol';
import type { AegisLoadout, AegisAbilityId } from './aegisCombat';
import { createDefaultPendingNarrativeCombatBoons } from './narrativeBonusReward';
import type { ResourceQuantity } from './resourceItem';
import type { LeyLineMutationId } from './leyLineMutation';
import type { EnvoyBoonId, HexShotBoonId } from './classBoon';
import type { EnvoyGraftId, HexShotGraftId } from './classGraft';
import type { VeilGraftId } from './veilGraft';
import type { BoundRequisitionRuntime } from './boundRequisition';
import { DEFAULT_AEGIS_LOADOUT } from './aegisCombat';
import {
  DEFAULT_ENVOY_LOADOUT,
  DEFAULT_HEX_SHOT_LOADOUT,
  type EnvoyLoadout,
  type HexShotLoadout,
} from './operativeClass';
import { createEmptyPatrolState } from './overworldPatrol';
import { createDefaultResonanceEscalationState } from './resonanceEscalation';
import { createDefaultCargoRunState } from './cargoGrid';
import { createEmptyOverworldSession } from './overworldFeatures';
import type {
  AttunementState,
  NodeSectorMeta,
  ResonanceState,
  SectorGraph,
} from './sector';
import { MAX_ATTUNEMENT, STARTING_ATTUNEMENT } from './sector';

export type FactionType = 'TERRAN_GRID' | 'LEGION' | 'SOLARIS';
export type ClassType = 'AEGIS' | 'HEX_SHOT' | 'ENVOY';
export type EncounterType = 'COMBAT' | 'SKILL_CHECK' | 'SANCTUARY';
export type BiomeType = 'HOSPITAL' | 'ALLEYWAYS' | 'SEWERS' | 'CHURCH' | 'FOREST' | 'CANYON';
export type ItemRarity = 'STANDARD' | 'STABILIZED' | 'COBALT' | 'ABYSSAL';
export type CheckStatus = 'NOT_TESTED' | 'SUCCESS' | 'FAILURE';
export type RunNodeType =
  | 'ANOMALY'
  | 'NARRATIVE_EVENT'
  | 'STANDARD_COMBAT'
  | 'ELITE_COMBAT'
  | 'BOSS_COMBAT'
  | 'SANCTUARY'
  | 'BLACK_MARKET'
  | 'EMERGENCY_EXTRACTION'
  | 'SAFE_ANCHOR_EXTRACTION'
  | 'MASTER_EXTRACTION_LINK'
  | 'RESOURCE_HARVEST'
  | 'VEIL_BLEED_BOON';

export type ExtractionReviewKind = 'SAFE_ANCHOR' | 'EMERGENCY_RECALL' | 'MASTER_LINK';

export type CombatObjective = 'ERADICATE' | 'SURVIVE_TURNS';

export type EliteCombatModifierId =
  | 'KINETIC_SHIELDING'
  | 'LETHAL_RETALIATION'
  | 'PHASE_SHROUD';
export type IncursionEncounterType =
  | 'COMBAT'
  | 'ANOMALY'
  | 'NARRATIVE_EVENT'
  | 'SANCTUARY'
  | 'BLACK_MARKET'
  | 'RESOURCE_HARVEST';
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
  /** Persistent Veil Residue harvested across incursions — donatable to Shadow War. */
  veilResidueBalance: number;
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
  /** Pre-run combat deck — four active abilities carried into each incursion (Aegis). */
  aegisLoadout: AegisLoadout;
  /** Hub-unlocked Aegis abilities available for loadout staging. */
  unlockedAegisAbilities: AegisAbilityId[];
  /** Pre-run Hex Shot deck — four tactical ballistic slots. */
  hexShotLoadout: import('./operativeClass').HexShotLoadout;
  /** Hub-unlocked Hex Shot abilities. */
  unlockedHexShotAbilities: import('./operativeClass').HexShotAbilityId[];
  /** Pre-run Envoy deck — four spell/curse slots. */
  envoyLoadout: import('./operativeClass').EnvoyLoadout;
  /** Hub-unlocked Envoy abilities. */
  unlockedEnvoyAbilities: import('./operativeClass').EnvoyAbilityId[];
  /** Hub-side abstract resource counts for fabrication. */
  resourceStash: ResourceQuantity;
  /** Crafted blueprint IDs unlocked at the metropolitan fabrication bench. */
  unlockedBlueprints: string[];
  /** Hub-forged passive augments available for pre-run loadout staging. */
  craftedAugments: import('./boundRequisition').BoundRequisitionId[];
  /** Hub-crafted tactical consumables awaiting run deployment. */
  hubCraftedConsumables: Partial<Record<import('./cargoGrid').CargoItemId, number>>;
  /** Pre-run cargo grid draft staged at the Safehouse. */
  preRunCargo: import('./cargoGrid').CargoRunState;
  /** Three tactical consumable slots armed for the next descent. */
  tacticalLoadout: [
    import('./cargoGrid').CargoItemId | null,
    import('./cargoGrid').CargoItemId | null,
    import('./cargoGrid').CargoItemId | null,
  ];
  /** Class weapon blueprint actively wired into combat hooks. */
  equippedBlueprintId: import('./equipmentBlueprint').BlueprintId | null;
  /** Safehouse decryption queue — gatekeeper cores/caskets land here as locked containers. */
  unidentifiedStash: import('./unidentifiedItem').UnidentifiedStashItem[];
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

export type NarrativeChoiceKey = 'A' | 'B' | 'C' | 'D';

export interface NarrativeChoiceOption {
  label: string;
  requirement: string;
  successText: string;
  failureText: string;
  effectPreview?: NarrativeChoiceEffectPreview;
  locked?: boolean;
  lockReason?: string;
}

export interface NarrativeProceduralMeta {
  engineVersion?: import('./narrativeProcedural').NarrativeEngineVersion;
  resolverSetId?: string;
  tensionMechanic?: import('./narrativeAssembly').TensionMechanic;
  defaultPenalty?: import('./narrativeAssembly').NarrativePenalty;
  /** Rolled at encounter generation — revealed on successful A/B/C resolve. */
  bonusReward?: import('./narrativeBonusReward').NarrativeBonusReward;
}

export interface NarrativeEventNode {
  id: string;
  matrixEventId?: string;
  interactionMode?: 'standard' | 'conditional' | 'procedural';
  title: string;
  scenarioText: string;
  /** Procedural encounters — hazard line shown above resolver options. */
  hazardPreview?: string;
  proceduralMeta?: NarrativeProceduralMeta;
  choiceA: NarrativeChoiceOption;
  choiceB: NarrativeChoiceOption;
  choiceC?: NarrativeChoiceOption;
  choiceD?: NarrativeChoiceOption;
}

export interface EnvironmentalModifiers {
  isEnemyPhaseShrouded: boolean;
  isPlayerBlinded: boolean;
  hasTetanusGlitch: boolean;
  startingStaminaPenalty: number;
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
  /** Resolved routing type for encounter screens. */
  type: RunNodeType;
  label: string;
  isCompleted: boolean;
  /** Boss terminal node — bypasses manual sweep mechanics. */
  isPreDiscovered?: boolean;
  sectorMeta?: NodeSectorMeta;
  isExtractionNode?: boolean;
  isAnomalyNest?: boolean;
  safeAnchorIndex?: 1 | 2 | 3;
  /** Procedural narrative tag filter — e.g. faction vault nodes. */
  narrativeTags?: readonly string[];
  /** High-stakes narrative band (Act III squeeze). */
  isHardNarrative?: boolean;
  /** District-entry combat vectors — engaging locks this biome for the chapter. */
  offeredMacroBiome?: import('./narrativeProcedural').MacroBiomeFamily;
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
  activeChoice: NarrativeChoiceKey | null;
  /** Player-facing depth (1–45); kept in sync with nodesCleared + 1. */
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
  /** Four active combat abilities locked at Safehouse (Aegis deck). */
  aegisLoadout: AegisLoadout;
  /** Hex Shot deck locked at run start. */
  hexShotLoadout: HexShotLoadout;
  /** Envoy deck locked at run start. */
  envoyLoadout: EnvoyLoadout;
  /** Operative class locked at run start. */
  activeClass: ClassType;
  /** Ley-Line mutations acquired this run — stack and alter combat behavior. */
  leyLineMutations: LeyLineMutationId[];
  /** Hex Shot class boons acquired this run. */
  hexShotBoons: HexShotBoonId[];
  /** Envoy class boons acquired this run. */
  envoyBoons: EnvoyBoonId[];
  /** Cabal locked at run start — gates procedural narrative resolvers. */
  alignedFaction: FactionType | null;
  /** Active macro biome — locked for the current district after first combat engage. */
  currentMacroBiomeFamily: import('./narrativeProcedural').MacroBiomeFamily | null;
  /** Previous district's locked biome (telemetry only). */
  lastMacroBiomeFamily: import('./narrativeProcedural').MacroBiomeFamily | null;
  /** Two biome offers on district-entry scanner hubs until combat is engaged. */
  pendingDistrictBiomeOffers: readonly [
    import('./narrativeProcedural').MacroBiomeFamily,
    import('./narrativeProcedural').MacroBiomeFamily,
  ] | null;
  /** True until the player engages a biome-tagged combat vector this district. */
  awaitingDistrictBiomeChoice: boolean;
  /** District 1 pick — excluded from district 2 offer pool. */
  depth1MacroBiomeChoice: import('./narrativeProcedural').MacroBiomeFamily | null;
  /** Buffs, debuffs, and timed boons — powers status popup. */
  runStatusEffects: import('./narrativeProcedural').RunStatusEffect[];
  /** Overworld pickups, pockets, raw boons, and Grid-Hound state. */
  overworldSession: import('./overworldFeatures').OverworldFeatureSession;
  /** Set when 6th Ley-Line boon requires swap modal. */
  pendingLeyBoonSwap: import('./overworldFeatures').PendingLeyBoonSwap | null;
  pendingClassBoonSwap: import('./overworldFeatures').PendingClassBoonSwap | null;
  /** Current black market node stock (soul-core + 2–4 rotating listings). */
  blackMarketStock: CargoItemId[];
  focusedNodeIds: string[];
  bossDefeated: boolean;
  primeExtractionBonus: boolean;
  sectorTier: number;
  cargo: CargoRunState;
  /** Spectral Salt deployed — kinetic weapons bypass spectral resistance. */
  spectralWeaponImbued: boolean;
  pendingHarvestReturn: HarvestReturnRoute | null;
  resonanceEscalations: ResonanceEscalationState;
  /** Safe anchor extractions used this run (1, 2, 3). */
  clearedSafeAnchors: readonly number[];
  collapseActive: boolean;
  pendingSafeAnchorIndex: 1 | 2 | 3 | null;
  extractionReviewKind: ExtractionReviewKind | null;
  masterLinkUsed: boolean;
  defendRiftActive: boolean;
  /** Whether the prior scanner hub offered any combat vector (pity-timer input). */
  lastLevelOfferedCombat: boolean;
  /** Active bound requisition modifiers — set at run start after requisition pick. */
  boundRequisition: BoundRequisitionRuntime | null;
  /** Next-combat narrative boons acquired from bonus loot. */
  pendingNarrativeCombatBoons: import('./narrativeBonusReward').PendingNarrativeCombatBoons;
  /** Veil Residue vacuumed into the run canister this incursion (capped at 100). */
  sessionVeilResidueCollected: number;
  /** Instance ids staged on the harvest screen — purged on exit unless packed or vacuumed. */
  harvestStagingInstanceIds: readonly string[];
  /** God Mode consumable active — 1000 STRIKE damage and locked max resources. */
  godModeActive: boolean;
  /** Pre-rolled sanctuary local levels per district chapter (includes mandatory L14). */
  sanctuarySchedule: import('../data/sanctuaryScheduleEngine').SanctuarySchedule;
  /** Cumulative strike damage bonus from sanctuary upgrades (%). Stacks per visit. */
  strikeDamageBonusPct: number;
  /** Veil-Grafts applied to Aegis loadout abilities for this incursion. */
  abilityGrafts: Partial<Record<import('./aegisCombat').AegisAbilityId, import('./veilGraft').VeilGraftId>>;
  /** Hex Shot grafts applied to loadout abilities for this incursion. */
  hexShotAbilityGrafts: Partial<Record<import('./operativeClass').HexShotAbilityId, HexShotGraftId>>;
  /** Envoy grafts applied to loadout abilities for this incursion. */
  envoyAbilityGrafts: Partial<Record<import('./operativeClass').EnvoyAbilityId, EnvoyGraftId>>;
  /** Rolled graft offers at the current sanctuary terminal (3 choices). */
  sanctuaryGraftOffers: (VeilGraftId | HexShotGraftId | EnvoyGraftId)[] | null;
  /** Set when Apex Graft disables ultimate for the active combat encounter. */
  encounterUltimateDisabled: boolean;
  /** Passive modifiers from secured Shadow War macro-sectors. */
  shadowWarBuffs: import('../data/shadowWarBuffEngine').ShadowWarRunBuffModifiers;
  /** Per-district encounter pacing — alpha duel index, anti-repetition history. */
  runSegment: import('../data/encounterGenerator').RunSegmentState | null;
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
    sectorGraph: { entryId: '', nodes: {}, sectorTier: 1, maxGraphDepth: 45 },
    currentNodeId: '',
    nodesCleared: 0,
    attunement: { current: STARTING_ATTUNEMENT, max: MAX_ATTUNEMENT },
    resonance: { percent: 0 },
    patrolState: createEmptyPatrolState(),
    aegisLoadout: [...DEFAULT_AEGIS_LOADOUT],
    hexShotLoadout: [...DEFAULT_HEX_SHOT_LOADOUT],
    envoyLoadout: [...DEFAULT_ENVOY_LOADOUT],
    activeClass: 'AEGIS',
    leyLineMutations: [],
    hexShotBoons: [],
    envoyBoons: [],
    alignedFaction: null,
    currentMacroBiomeFamily: null,
    lastMacroBiomeFamily: null,
    pendingDistrictBiomeOffers: null,
    awaitingDistrictBiomeChoice: false,
    depth1MacroBiomeChoice: null,
    runStatusEffects: [],
    overworldSession: createEmptyOverworldSession(),
    pendingLeyBoonSwap: null,
    pendingClassBoonSwap: null,
    blackMarketStock: [],
    focusedNodeIds: [],
    bossDefeated: false,
    primeExtractionBonus: false,
    sectorTier: 1,
    cargo: createDefaultCargoRunState(),
    spectralWeaponImbued: false,
    pendingHarvestReturn: null,
    resonanceEscalations: createDefaultResonanceEscalationState(),
    clearedSafeAnchors: [],
    collapseActive: false,
    pendingSafeAnchorIndex: null,
    extractionReviewKind: null,
    masterLinkUsed: false,
    defendRiftActive: false,
    lastLevelOfferedCombat: true,
    boundRequisition: null,
    pendingNarrativeCombatBoons: createDefaultPendingNarrativeCombatBoons(),
    sessionVeilResidueCollected: 0,
    harvestStagingInstanceIds: [],
    godModeActive: false,
    sanctuarySchedule: { 1: [14], 2: [14], 3: [14] },
    strikeDamageBonusPct: 0,
    abilityGrafts: {},
    hexShotAbilityGrafts: {},
    envoyAbilityGrafts: {},
    sanctuaryGraftOffers: null,
    encounterUltimateDisabled: false,
    shadowWarBuffs: {
      maxHpBonusPct: 0,
      kineticArmorBonus: 0,
      rareLootBonusPct: 0,
      blackMarketDiscountPct: 0,
      firstTurnApBonus: 0,
    },
    runSegment: null,
  };
}
