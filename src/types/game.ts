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
import {
  createDefaultRunItemRuntime,
  createDefaultRunItemsSlotState,
} from './runItem';
import {
  createEmptyRunPhysicalBankSnapshot,
  createEmptyRunResourceLedger,
} from './runResourceLedger';
import { createEmptyContractRunProgress } from './contract';
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
import { createDefaultBalanceRunStats } from '../data/balance/balanceRunStats';

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
  /** Persistent Veil Residue harvested across incursions — vaulted at extraction. */
  veilResidueBalance: number;
  alignedFaction: FactionType | null;
  /** Per-sponsor reputation from completed contracts. */
  sponsorReputation: Partial<Record<FactionType, number>>;
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
  /** @deprecated Reset on load — use weaponUnlocks. */
  unlockedBlueprints?: string[];
  /** Permanent weapon family unlocks. */
  weaponUnlocks: import('./weapon').WeaponFamilyId[];
  /** Highest tier achieved per weapon family (1–3). */
  weaponTiers: Partial<Record<import('./weapon').WeaponFamilyId, import('./weapon').WeaponTierNumber>>;
  /** Equipped weapon per operative class. */
  equippedWeaponByClass: Partial<Record<ClassType, import('./weapon').WeaponFamilyId>>;
  /** Hub-forged passive augments available for pre-run loadout staging. */
  craftedAugments: import('./boundRequisition').BoundRequisitionId[];
  /** Hub-crafted tactical consumables awaiting run deployment. */
  hubCraftedConsumables: Partial<Record<import('./cargoGrid').CargoItemId, number>>;
  /** Pre-run cargo grid draft staged at the Safehouse. */
  preRunCargo: import('./cargoGrid').CargoRunState;
  /** Three tactical consumable slots armed for the next descent (legacy non-run items). */
  tacticalLoadout: [
    import('./cargoGrid').CargoItemId | null,
    import('./cargoGrid').CargoItemId | null,
    import('./cargoGrid').CargoItemId | null,
  ];
  /** Pre-run Run Item v2 slots — 2 combat + 2 field, separate from cargo grid. */
  runItemLoadout: import('./runItem').RunItemsSlotState;
  /** @deprecated Reset on load — use equippedWeaponByClass. */
  equippedBlueprintId?: import('./equipmentBlueprint').BlueprintId | null;
  /** Safehouse decryption queue — gatekeeper cores/caskets land here as locked containers. */
  unidentifiedStash: import('./unidentifiedItem').UnidentifiedStashItem[];
  /** Career totals from post-run cargo routing decisions. */
  careerCargoRouting: import('../data/postRunCargoRoutingRunState').CareerCargoRoutingStats;
  /** Per-sponsor trust telemetry from contracts and betrayal v1. */
  sponsorTrustStats: Partial<Record<FactionType, import('../types/betrayal').SponsorTrustStats>>;
  /** Recent betrayal events for future Betrayer Echo hooks. */
  betrayalHistory: import('../types/betrayal').BetrayalEvent[];
  /** Per-stack appraisal metadata for sealed cargo in stash. */
  sealedCargoStacks: import('../types/sealedCargo').SealedCargoStackMeta[];
  /** Career sealed cargo action totals. */
  careerSealedCargo: import('../types/sealedCargo').CareerSealedCargoStats;
  /** Pre-run Expedition Relic equipped for the next incursion (Trinkets v2). */
  equippedKeepsakeId: import('../types/expeditionKeepsake').KeepsakeId | null;
  /** Hub-unlocked Expedition Relics available for equip. */
  unlockedKeepsakeIds: readonly import('../types/expeditionKeepsake').KeepsakeId[];
  /** Pre-run deployment choices for relics that expose configuration (attunement/doctrine/mirror category). */
  keepsakeDeployment: import('../types/expeditionKeepsake').KeepsakeDeployment;
  /** Career last-N run balance summaries for the balance dashboard (Phase B). */
  careerBalanceHistory: import('../data/balance/balanceDashboardEngine').CareerBalanceHistory;
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
  /** @deprecated Legacy district-entry offer — sector runVeilBiome is authoritative. */
  offeredMacroBiome?: import('./narrativeProcedural').MacroBiomeFamily;
  /** Veil Front node context from procedural generation. */
  contextModifiers?: import('./worldState').NodeContextModifiers;
  /** Phase F — display-only type/certainty (true routing type stays in `type`). */
  scannerDisplayedType?: RunNodeType;
  scannerLabelCertainty?: 'RELIABLE' | 'DEGRADED' | 'STRANGE';
  scannerStrangeLabel?: string;
  scannerLabelCorrupt?: boolean;
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
  /** Veil Front sector biome — locked for entire run (Phase 2+ spawn authority). */
  runVeilBiome: import('./encounterSpawn').VeilBiome | null;
  /** Active macro biome — locked for the current district after first combat engage. */
  currentMacroBiomeFamily: import('./narrativeProcedural').MacroBiomeFamily | null;
  /** Previous district's locked biome (telemetry only). */
  lastMacroBiomeFamily: import('./narrativeProcedural').MacroBiomeFamily | null;
  /** @deprecated District biome choice removed — kept for save compatibility. */
  pendingDistrictBiomeOffers: readonly [
    import('./narrativeProcedural').MacroBiomeFamily,
    import('./narrativeProcedural').MacroBiomeFamily,
  ] | null;
  /** @deprecated District biome choice removed — kept for save compatibility. */
  awaitingDistrictBiomeChoice: boolean;
  /** @deprecated District biome choice removed — kept for save compatibility. */
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
  /** Vaulted residue carried into this run from the safehouse balance at descent. */
  runVeilResidueBaseline: number;
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
  /** VOID'S TOLL — permanent +1 AP per ultimate kill this incursion. */
  voidsTollApBonus: number;
  /** Passive modifiers derived from Veil Front sector + contract selection. */
  runModifiers: import('../types/worldState').RunModifierSnapshot;
  /** Full meta-to-run context frozen at descent — depth resolved per node later. */
  runGenerationContext: import('../types/worldState').RunGenerationContext | null;
  /** Unified procedural sector crisis — frozen at descent. */
  runWorldBrief: import('../types/runWorldBrief').RunWorldBrief | null;
  /** Depth 2 Distortion + Depth 3 Deep Veil Law identity for the active run. */
  depthIdentity: import('./depthIdentity').DepthIdentityState | null;
  /** Phase B — pre-combat warning card pending confirm/back. */
  pendingEncounterWarning: import('./encounterComposition').EncounterWarningCard | null;
  /** Phase D — composition telemetry for Encounter Highlights. */
  compositionRunState: import('./encounterComposition').CompositionRunState | null;
  /** Sponsor contract snapshot frozen at descent. */
  activeContract: import('../types/contract').ActiveRunContract | null;
  /** Contract-specific run facts consumed by the contract resolver at debrief. */
  contractRunProgress: import('../types/contract').ContractRunProgress;
  /** Operation contribution already applied mid-run (operation/anchor signal clears). */
  operationContributionTransmitted: number;
  /** Per-district encounter pacing — alpha duel index, anti-repetition history. */
  runSegment: import('../data/encounterGenerator').RunSegmentState | null;
  /** Unstable cargo types that already triggered first-pickup run log this incursion. */
  unstableCargoPickupLogged: import('./unstableCargoEffects').UnstableCargoEffectId[];
  /** Unstable cargo carried-effect types that were physically active at any point this incursion. */
  unstableCargoEffectsSeen: import('./unstableCargoEffects').UnstableCargoEffectId[];
  /** Pre-generated StS-style 15-depth branching map for scanner routing. */
  proceduralRunTree: import('./proceduralRunTree').ProceduralRunTree | null;
  /** Scanner nodes sonar-pinged — immediate child types revealed. */
  revealedSonarNodeIds: readonly string[];
  /** Pre-rolled procedural resource harvest loot for the active node engage. */
  pendingProceduralResourcePool: readonly string[];
  /** Anchor Assault operation progress tracked during the run. */
  anchorAssaultProgress: import('../data/anchorAssaultEngine').AnchorAssaultProgress;
  /** Echo Recovery residue defeats tracked during the run. */
  echoRecoveryProgress: import('../data/echoRecoveryEngine').EchoRecoveryProgress;
  /** Echo encounter activity tracked for debrief and operations. */
  echoRunState: import('../data/echoRunState').EchoRunState;
  /** Special cargo acquisition and banking tracked for debrief and telemetry. */
  cargoRoutingRunState: import('../data/postRunCargoRoutingRunState').CargoRoutingRunState;
  /** Expedition keepsake runtime for this incursion (Trinkets v1.5). */
  keepsakeRuntime: import('../types/expeditionKeepsake').KeepsakeRuntime | null;
  /** Signal Compass — nodes fully interpreted on the active scanner layer. */
  keepsakeFullyInterpretedNodeIds: readonly string[];
  /** Ashen Cartograph — next-depth node id receiving a ghost type preview. */
  keepsakeCartographGhostNodeId: string | null;
  /** Ashen Cartograph — two-step ghost route preview node ids. */
  keepsakeCartographGhostNodeIds: readonly string[];
  /** Grave Polaroid — imprint intel shown before echo entry. */
  keepsakeGravePolaroidPreview: {
    nodeId: string;
    lines: readonly string[];
  } | null;
  /** Cargo Seal — sealed unstable instances cannot be jettisoned until safehouse/extract. */
  keepsakeJettisonLockedInstanceIds: readonly string[];
  /** Extraction Token — stamped safe extraction node highlighted on scanner. */
  keepsakeStampedExtractionNodeId: string | null;
  /** Node id for active extraction review (safe anchor / master link). */
  pendingExtractionNodeId: string | null;
  /** In-run safehouse physical bank — survives death within the same run. */
  runBankedSnapshot: import('../types/runResourceLedger').RunPhysicalBankSnapshot;
  /** Per-run resource collection, banking, extraction, and loss accounting. */
  runResourceLedger: import('../types/runResourceLedger').RunResourceLedger;
  /** Run Item v2 slot inventory — separate from cargo grid (2 combat + 2 field). */
  runItems: import('../types/runItem').RunItemsSlotState;
  /** Snapshot of run items committed at descent — used for debrief "brought" lines. */
  runItemsAtRunStart: import('../types/runItem').RunItemsSlotState;
  /** Run Item v2 per-run counters, triggers, and pending effects. */
  itemRuntime: import('../types/runItem').RunItemRuntime;
  /** Weapon family locked at run start. */
  activeWeaponFamilyId: import('./weapon').WeaponFamilyId;
  /** Weapon tier locked at run start. */
  activeWeaponTier: import('./weapon').WeaponTierNumber;
  /** Once-per-combat weapon passive counters. */
  weaponRuntime: import('./weapon').WeaponRuntimeState;
  /** Phase B — in-run combat/economy counters for balance telemetry. */
  balanceRunStats: import('../data/balance/balanceRunStats').BalanceRunStats;
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
    runVeilBiome: null,
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
    runVeilResidueBaseline: 0,
    harvestStagingInstanceIds: [],
    godModeActive: false,
    sanctuarySchedule: { 1: [14], 2: [14], 3: [14] },
    strikeDamageBonusPct: 0,
    abilityGrafts: {},
    hexShotAbilityGrafts: {},
    envoyAbilityGrafts: {},
    sanctuaryGraftOffers: null,
    encounterUltimateDisabled: false,
    voidsTollApBonus: 0,
    runModifiers: {
      maxHpBonusPct: 0,
      kineticArmorBonus: 0,
      rareLootBonusPct: 0,
      blackMarketDiscountPct: 0,
      firstTurnApBonus: 0,
    },
    runGenerationContext: null,
    runWorldBrief: null,
    depthIdentity: null,
    pendingEncounterWarning: null,
    compositionRunState: null,
    activeContract: null,
    contractRunProgress: createEmptyContractRunProgress(),
    operationContributionTransmitted: 0,
    runSegment: null,
    unstableCargoPickupLogged: [],
    unstableCargoEffectsSeen: [],
    proceduralRunTree: null,
    revealedSonarNodeIds: [],
    pendingProceduralResourcePool: [],
    anchorAssaultProgress: { elitesDefeated: 0, coreCleared: false },
    echoRecoveryProgress: { echoesDefeated: 0, legendaryDefeated: 0 },
    echoRunState: {
      echoSignalsDiscovered: 0,
      echoSignalsResolved: 0,
      fallenEchoesLooted: 0,
      echoesStabilized: 0,
      hostileEchoesDefeated: 0,
      cargoEchoesRecovered: 0,
      assistEchoesTriggered: 0,
      extractionEchoesUsed: 0,
      echoOperationProgress: 0,
      echoGlassRecovered: 0,
      echoCreditsRecovered: 0,
      echoRewardsExtracted: 0,
      extractionRecallBonusPending: false,
    },
    cargoRoutingRunState: {
      specialCargoStacksAcquired: 0,
      contractTargetStacksAcquired: 0,
      operationTargetStacksAcquired: 0,
      specialCargoStacksBanked: 0,
      pendingRoutingStacksAtExtract: 0,
    },
    keepsakeRuntime: null,
    keepsakeFullyInterpretedNodeIds: [],
    keepsakeCartographGhostNodeId: null,
    keepsakeCartographGhostNodeIds: [],
    keepsakeGravePolaroidPreview: null,
    keepsakeJettisonLockedInstanceIds: [],
    keepsakeStampedExtractionNodeId: null,
    pendingExtractionNodeId: null,
    runBankedSnapshot: createEmptyRunPhysicalBankSnapshot(),
    runResourceLedger: createEmptyRunResourceLedger(),
    runItems: createDefaultRunItemsSlotState(),
    runItemsAtRunStart: createDefaultRunItemsSlotState(),
    itemRuntime: createDefaultRunItemRuntime(),
    activeWeaponFamilyId: 'aegis-runed-longsword',
    activeWeaponTier: 1,
    weaponRuntime: {
      firstMeleeHitUsed: false,
      firstFractureUsed: false,
      firstReloadUsed: false,
      firstOccultAbilityUsed: false,
      firstDebuffApplied: false,
      sacrificeHpBonusUsed: false,
      firstArmoredHitUsed: false,
      postReloadBallisticBonus: false,
    },
    balanceRunStats: createDefaultBalanceRunStats(),
  };
}
