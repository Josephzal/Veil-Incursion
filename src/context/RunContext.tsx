import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { pickRandomClimateCluster, getClusterDefinition } from '../data/climateClusters';
import { AMBUSH_ENCOUNTERS_ENABLED } from '../data/featureFlags';
import { anomalyResolutionLogLine, resolveAnomalyNode } from '../data/anomalyResolver';
import {
  canGraftClassAbility,
  getClassGraftDefinition,
  rollClassGraftOffers,
} from '../data/classGraftEngine';
import { MAX_RUN_CANISTER_RESIDUE } from '../constants/veilResidue';
import { resolveStartingRunCanisterResidue } from '../data/veilResidueRunEngine';
import {
  createEasyTestEnemy,
  createHardTestEnemy,
  spawnGridHoundProfile,
  spawnVeilStalkerProfile,
} from '../data/enemies';
import {
  applyEliteModifierToEnvironment,
  ELITE_MODIFIER_LABELS,
  rollEliteModifier,
} from '../data/eliteModifierEngine';
import {
  anchorAssaultEngageLogLines,
  anchorAssaultClearLogLine,
  applyAnchorAssaultSpawnScaling,
  applyAnchorCoreBossProfile,
  applyAnchorRealityToEnvironment,
  createDefaultAnchorAssaultProgress,
  recordAnchorAssaultVictory,
  resolveAnchorAssaultContext,
} from '../data/anchorAssaultEngine';
import {
  applyEchoResidueToEnvironment,
  createDefaultEchoRecoveryProgress,
  echoRecoveryClearLogLine,
  echoRecoveryEngageLogLines,
  recordEchoRecoveryVictory,
  resolveEchoRecoveryContext,
} from '../data/echoRecoveryEngine';
import { isCollapseForwardNode } from '../data/pocketDimensionEngine';
import {
  buildEncounter,
  getThemedSkillChecks,
  INITIAL_SECTOR_POOL,
  pickRandomTrinkets,
  TRINKET_POOL,
} from '../data/regions';
import {
  BASE_MAX_SOUL_ANCHOR,
  BASE_MAX_STAMINA,
  ClimateClusterId,
  EncounterNode,
  RadarDot,
  RunState,
  SkillCheckEvent,
  Trinket,
  TOTAL_RUN_NODES,
} from '../types/run';
import {
  ActiveIncursionState,
  BiomeType,
  CheckStatus,
  ClassType,
  createDefaultActiveIncursionState,
  FactionModifiers,
  FactionType,
  IncursionMapMode,
  IncursionNode,
  NarrativeEventNode,
} from '../types/game';
import { buildProceduralScannerCluster, getAvailableProceduralNodeIds, isProceduralRunActive, prepareProceduralScannerIncursion, proceduralNodeToIncursionNode } from '../data/proceduralScannerBridge';
import { ensureNodeContextModifiersAtEngagement } from '../data/lazyNodeContextEngine';
import { initializeSectorRun, regenerateProceduralRunTree } from '../data/macroStoryPipeline';
import { rollProceduralResourcePool } from '../data/proceduralResourceEngine';
import {
  primeNarrativeEnvironment,
  resolveMatrixNarrativeChoice,
  rollVirtualD20,
} from '../data/narrativeEncounterMatrix';
import {
  enrichProceduralNarrativeNode,
  pickSectorNarrativeForNode,
} from '../data/sectorNarrativeEngine';
import {
  resolveProceduralNarrativeChoice,
} from '../data/narrative/narrativeProceduralEngine';
import { resolveAssemblyNarrativeChoice } from '../data/narrative/narrativeAssemblyResolver';
import {
  applyBoonToPending,
  applyVeilResidueBonus,
  runStatusEffectForBoon,
  stripNarrativeBoonStatusEffects,
} from '../data/narrative/narrativeBonusLoot';
import type { PendingNarrativeCombatBoons } from '../types/narrativeBonusReward';
import { createDefaultPendingNarrativeCombatBoons } from '../types/narrativeBonusReward';
import type { ProceduralNarrativeAssembly } from '../types/narrativeProcedural';
import {
  formatMacroBiomeLogLine,
  getMacroBiomeContextLog,
} from '../data/macroBiomeEngine';
import {
  sectorIdToLegacyMacroBiome,
  sectorIdToVeilBiome,
  veilBiomeDisplayName,
} from '../data/sectorBiomeBridge';
import {
  createGridHound,
  generateOverworldFeatures,
  isInsideResonancePocket,
  isPlayerCaughtByGridHound,
  resonancePocketTickRate,
  tickGridHound,
} from '../data/overworldFeatureEngine';
import { SCOUT_ARENA_HEIGHT, SCOUT_ARENA_WIDTH } from '../utils/scoutArenaLayout';
import {
  DIRECTED_PING_RESONANCE_COST,
  LEY_BOON_SWAP_HP_COST_PCT,
  MAX_LEY_MUTATIONS,
  RAW_LEY_BOON_HP_DEBUFF_PCT,
  RAW_LEY_BOON_RESONANCE_COST,
  type PendingLeyBoonSwap,
} from '../types/overworldFeatures';
import type { RunStatusEffect } from '../types/narrativeProcedural';
import type { AegisFacing } from '../utils/overworldRadarProjection';
import {
  harvestResonanceSpikeForTier,
} from '../data/resonanceProgressionEngine';
import {
  depthFromNodesCleared,
  getDistrictFromDepth,
  buildDistrictIntelForRun,
  isDistrictGateDepth,
  isPrimeBossDepth,
  localLevelFromDepth,
} from '../data/districtPacing';
import {
  applyBenchHealthRestore,
  transferRunCargoToBank,
} from '../data/cargoBankingEngine';
import { createEmptyPatrolState } from '../types/overworldPatrol';
import {
  computeClearVent,
  computeScanPenalty,
  getResonanceZone,
  isCombatVentNode,
} from '../data/resonanceHeatVentEngine';
import {
  buildResonanceMutationPatch,
} from '../data/resonanceMutationEngine';
import { resolvePatrolState } from '../data/patrolSpawnEngine';
import { isEmergencyRecallAvailable, isFullBlindZone } from '../data/sectorZoneEngine';
import {
  EMERGENCY_EXTRACT_CARGO_BLEED_PCT,
  MASTER_EXTRACTION_PAYOUT_MULTIPLIER,
} from '../types/sectorPacing';
import type { ExtractionReviewKind } from '../types/game';
import {
  createBossProfileForDepth,
  findVectorInCluster,
  isBossNodeType,
} from '../data/descentEngine';
import {
  sanitizeEnvoyCombatLoadout,
  sanitizeHexShotCombatLoadout,
} from '../data/classAbilityUnlockEngine';
import { clusterOffersCombat, VEIL_BLEED_HP_COST_PCT } from '../data/descentLevelMatrix';
import {
  buildScannerCluster,
  ensureForwardVectorsOnGraph,
  resolveScannerGraphNodeId,
  getGreedZoneActive,
} from '../data/sectorGraphEngine';
import {
  clearVeilStalkerHunt,
  consumeExtractionDecoy,
  isTerminalBlindActive,
} from '../data/resonanceEscalationEngine';
import {
  buildEnvironmentalModifiersForNode,
} from '../data/combatEnvironmentEngine';
import {
  addLootToContainment,
  applyDataBleedToCargo,
  applyEmergencyExtractBleed,
  buildHarvestLoot,
  calculateCargoMarketValue,
  calculateGridOccupancy,
  getCargoResonanceMultiplier,
  isVeilResidueCargoItem,
  placeCargoFromContainment,
  placeStagedBlackMarketCargoAtCell,
  clearBlackMarketStagedFlags,
  listStagedBlackMarketPlacements,
  finalizeHarvestCargoState,
  relocateCargoItem as relocateCargoItemState,
  resetCargoInstanceCounter,
  scaledLootCount,
  hasCargoItem,
  consumeCargoItem,
  createStarterCargoRunState,
  applyIncursionStarterCargo,
  removePlacedCargoItem,
} from '../data/cargoGridEngine';
import { resolveExtractionVeilResidueDeposit } from '../data/extractionPersistenceEngine';
import {
  bankAllPhysicalRunCargo,
  recordNewResourcesFromCargoDelta,
  recordResourcesBanked,
  recordSafehouseBankAction,
  resolveRunDeathResourceState,
  summarizeBankSnapshot,
} from '../data/runResourceLedgerEngine';
import {
  createInitialContractRunProgress,
  recordContractDepthBossDefeated,
  recordContractDepthReached,
  recordContractEliteKill,
  recordContractEmergencyRecall,
  recordContractOperationTargetCleared,
  recordContractAnomalyCleared,
} from '../data/contractRunProgressEngine';
import { resolveContractResult } from '../data/contractResolver';
import type { RunDeathSummary } from '../types/runDeathSummary';
import {
  formatCombatResourceDropLog,
  rollCombatResourceDrops,
  type CombatRewardContext,
} from '../data/combatRewardEngine';
import { applyResourceBundleToCargo } from '../data/resourceCargoBridge';
import { getResourceCacheBundle } from '../data/resourceCacheBundles';
import {
  detectNewUnstableCargoPickups,
  formatEmergencyRecallVeilAshWarning,
  formatUnstableCargoPickupLog,
  hasVeilAshCanisterCarried,
  mergeUnstableCargoEffectsSeen,
  resolveCargoHealReceivedMultiplier,
  resolveEffectiveOccultRewardBonusPct,
  resolveEffectiveRareLootBonusPct,
} from '../data/unstableCargoEffectsEngine';
import type { CargoRunState } from '../types/cargoGrid';
import { CARGO_ITEM_CATALOG, HARVEST_YIELD_OPTIONS } from '../types/cargoGrid';
import type { HarvestYieldTier } from '../types/cargoGrid';
import {
  MAX_SECTOR_NODES,
  RESONANCE_TIER_DATA_BLEED,
  VEIL_STALKER_AMBUSH_CHANCE,
} from '../types/sector';
import { rollSanctuarySchedule } from '../data/sanctuaryScheduleEngine';
import { createRunSegment, applyEncounterToSegment } from '../data/encounterGenerator';
import { districtBossLogLine } from '../data/districtBosses';
import { spawnDistrictBossSquad } from '../data/bossCombat';
import { createDefaultIncursionInventory } from '../data/incursionInventory';
import { encounterBudgetForDepth } from '../data/combatEncounterBudget';
import { spawnCombatSquad, resolveEngagedEncounterSnapshot, squadFromSingleEnemy } from '../data/combatSpawnEngine';
import { listingsForStock, rollBlackMarketStock, resolveBlackMarketListingPrice, blackMarketFencePrice } from '../data/blackMarket';
import {
  buildDevSandboxCombatNode,
  buildDevSandboxEligibility,
  buildDevSandboxNarrativeEncounter,
  resolveDevSandboxTensionMechanic,
} from '../data/devSandboxEngine';
import type { DevSandboxPreset } from '../types/devSandbox';
import {
  getClassBoonDisplayName,
  preparePostCombatBoonOffers,
} from '../data/classBoonEngine';
import type { PostCombatBoonOffer } from '../types/classBoon';
import type { EnvoyBoonId, HexShotBoonId } from '../types/classBoon';
import type { LeyLineMutationId } from '../types/leyLineMutation';
import type { AegisLoadout } from '../types/aegisCombat';
import type { EnvoyLoadout, HexShotLoadout } from '../types/operativeClass';
import type { CargoItemId } from '../types/cargoGrid';
import type { IncursionConsumableId, IncursionConsumableUseResult } from '../types/incursionInventory';
import type { BoundRequisitionDefinition, BoundRequisitionId } from '../types/boundRequisition';
import { rollBoundRequisitionOffers } from '../data/boundRequisitions';
import {
  applyBoundRequisitionAtRunStart,
  applyCraftedAugmentPassives,
  buildBoundRequisitionRuntime,
  consumeAdrenalinePrimerCombat,
  consumeScavengerMarkDiscount,
  getBlackMarketDiscountPct,
  getEffectiveBlackMarketPrice,
  isLeyScarAcquisitionBlocked,
  modifyScanResonanceGain,
  shouldGrantAdrenalinePrimerAp,
  tickChalkLineWardAfterNodeClear,
} from '../data/boundRequisitionEngine';
import type { PlayerAccount } from '../types/game';
import { usePlayerAccount } from './PlayerAccountContext';
import type { UnstableCargoEffectId } from '../types/unstableCargoEffects';

function mergeUnstableCargoPickupLog(
  beforeCargo: CargoRunState,
  afterCargo: CargoRunState,
  alreadyLogged: readonly UnstableCargoEffectId[],
): UnstableCargoEffectId[] {
  const newPickups = detectNewUnstableCargoPickups(beforeCargo, afterCargo, alreadyLogged);
  return [...alreadyLogged, ...newPickups];
}

export interface RunStartConfig {
  factionPerks?: FactionModifiers;
  unlockedBiomes?: BiomeType[];
  sectorTier?: number;
  aegisLoadout?: AegisLoadout;
  hexShotLoadout?: HexShotLoadout;
  envoyLoadout?: EnvoyLoadout;
  activeClass?: ClassType;
  alignedFaction?: FactionType | null;
  /** Safehouse cargo grid + tactical slots committed on descent. */
  initialCargo?: import('../types/cargoGrid').CargoRunState;
  /** Persistent Veil Residue balance loaded into the run canister at descent. */
  startingVeilResidueBalance?: number;
  runGenerationContext?: import('../types/worldState').RunGenerationContext;
  runModifiers?: import('../types/worldState').RunModifierSnapshot;
}

export interface BadgeTestCombatConfig {
  activeClass: ClassType;
  aegisLoadout: AegisLoadout;
  hexShotLoadout: HexShotLoadout;
  envoyLoadout: EnvoyLoadout;
  alignedFaction?: FactionType | null;
}

interface RunContextType {
  runState: RunState;
  /** Active dev TEST tab sandbox preset, if any. */
  devSandboxPreset: DevSandboxPreset | null;
  runLog: string[];
  deathSummary: import('../types/runDeathSummary').RunDeathSummary | null;
  scanSessionKey: number;
  postCombatMutationChoices: PostCombatBoonOffer[];
  appendRunLog: (text: string) => void;
  /** Clears log and enables combat-only logging for the next encounter. */
  beginCombatRunLogSession: () => void;
  setCombatLogActive: (active: boolean) => void;
  clearRunLog: () => void;
  startNewRun: (config?: RunStartConfig) => void;
  recordRunKillAttacker: (designation: string) => void;
  boundRequisitionOffers: BoundRequisitionDefinition[];
  prepareBoundRequisitionOffers: (account: PlayerAccount) => void;
  confirmBoundRequisition: (
    id: BoundRequisitionId,
    craftedAugments?: readonly BoundRequisitionId[],
  ) => void;
  consumeAdrenalinePrimerAfterCombat: () => void;
  /** Read pending next-combat narrative boons without mutating run state. */
  peekPendingNarrativeCombatBoons: () => PendingNarrativeCombatBoons;
  /** Clears pending narrative boons after they have been consumed by combat init. */
  clearPendingNarrativeCombatBoons: () => void;
  /** @deprecated Use peek + clearPendingNarrativeCombatBoons */
  claimPendingNarrativeCombatBoons: () => PendingNarrativeCombatBoons;
  /** Removes narrative boon entries from the status overlay after combat. */
  clearNarrativeBoonStatusEffects: () => void;
  isPostCombatBoonBlocked: () => boolean;
  beginScanSession: () => void;
  commitRadarDot: (dot: RadarDot) => EncounterNode;
  advanceNode: () => { hasNext: boolean; completedCount: number };
  completeNodeAfterMutation: (boonId: string) => void;
  incrementCombatNodesCleared: () => void;
  syncAfterCombat: (remainingHp: number, remainingStamina: number) => void;
  refillStaminaAfterCombat: () => void;
  applyTrinket: (trinket: Trinket) => void;
  preparePostCombatMutations: () => PostCombatBoonOffer[];
  applyLeyLineMutation: (mutationId: LeyLineMutationId) => void;
  applyHexShotBoon: (boonId: HexShotBoonId) => void;
  applyEnvoyBoon: (boonId: EnvoyBoonId) => void;
  rollBlackMarketStockForNode: () => void;
  useResonanceBribeFromCargo: () => boolean;
  useDeadDropTokenFromCargo: () => boolean;
  applySkillCheckTier: (tier: 'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'CRITICAL_DESYNC', logLine: string) => void;
  applySanctuaryAttune: () => void;
  openSanctuaryGraftTerminal: () => void;
  applyClassGraftToAbility: (abilityId: string, graftId: string) => { success: boolean; message: string };
  getVeilResidueBalance: () => number;
  clearEncounterUltimateDisabled: () => void;
  getCurrentEncounter: () => EncounterNode | null;
  getCurrentSkillCheck: () => SkillCheckEvent | null;
  endRun: (reason: string) => void;
  getRunElapsedMs: () => number | null;
  getLastKillingEnemyDesignation: () => string | null;
  registerOperationContributionApplier: (
    applier: ((operationId: string, amount: number) => Promise<void>) | null,
  ) => void;
  setPendingAmbush: (value: boolean) => void;
  clearPendingAmbush: () => void;
  assignNarrativeForCombat: (encounterNode?: IncursionNode | null) => void;
  getCurrentNarrativeNode: () => NarrativeEventNode | null;
  resolveNarrativeChoice: (
    choice: import('../types/game').NarrativeChoiceKey,
    status?: CheckStatus,
    options?: { tensionBonusCredits?: number },
  ) => {
    outcomeText: string;
    aborted: boolean;
    creditReward: number;
    requiresResourcePack: boolean;
    triggerCombatAmbush: boolean;
  };
  abortNarrativeEncounter: () => void;
  activeIncursion: ActiveIncursionState;
  getCurrentEncounterNode: () => import('../types/game').IncursionNode | null;
  stageEncounterClear: (message: string) => {
    route: 'NEXT_NODE' | 'SAFEHOUSE' | 'HUB_VICTORY';
  };
  continueFromProgressCheckpoint: () => {
    route: 'NEXT_NODE' | 'SAFEHOUSE' | 'HUB_VICTORY';
  };
  transitionToNextDistrict: () => void;
  transferRunCargoToBankVault: (percent: number) => {
    success: boolean;
    logLine: string;
    transferredValue?: number;
  };
  vaultIncursionVeilResidueToAccount: () => { deposited: number };
  restoreHealthFromBench: () => { success: boolean; logLine: string };
  getSafehouseIntel: () => import('../data/districtPacing').DistrictIntelBrief;
  focusPreviewNode: () => boolean;
  spendAttunementCharge: () => boolean;
  calculateSectorExtractionPayout: () => number;
  placeCargoItem: (instanceId: string, row: number, col: number) => boolean;
  relocateCargoItem: (instanceId: string, row: number, col: number) => boolean;
  discardCargoInstance: (instanceId: string) => boolean;
  applyHarvestChoice: (tier: HarvestYieldTier) => { logLines: string[]; ambushTriggered: boolean };
  useFocusingAmpouleFromCargo: () => boolean;
  useSonarPingOnNode: (nodeId: string) => boolean;
  hasSonarPingInCargo: () => boolean;
  beginPostCombatHarvest: (initialStagingIds?: readonly string[]) => void;
  beginResourceNodeHarvest: (resourcePool?: readonly string[]) => void;
  beginResourceCachePack: () => void;
  finalizeHarvestScreen: () => void;
  grantCombatResourceDrops: (options: CombatRewardContext) => readonly string[];
  grantCombatSalvage: (resourceId: import('../types/resourceItem').ResourceItemId, quantity: number) => void;
  applyVoidsTollSacrifice: () => void;
  absorbVeilResidueParticle: (instanceId: string, value: number, finalizeInstance: boolean) => number;
  prepareBossEncounter: (engagedNode?: IncursionNode | null) => void;
  prepareStandardCombatEncounter: (engagedNode?: IncursionNode | null) => void;
  prepareHarvestAmbushEncounter: () => void;
  shiftBossPhase: (phase: number) => void;
  setIncursionMapMode: (mode: IncursionMapMode) => void;
  purgeEncounterState: () => void;
  commitNodeEncounter: (nodeId: string) => import('../types/game').RunNodeType | null;
  getCurrentVectorCluster: () => import('../types/game').IncursionNode[];
  /** Persists lazy type rolls for the current scanner depth (Phase 3). */
  syncProceduralScannerTypes: () => void;
  ensureScannerGraphExpanded: () => void;
  getSelectedVectorNode: () => import('../types/game').IncursionNode | null;
  openScanPreview: (nodeId: string) => void;
  closeScanPreview: () => void;
  confirmScanPreview: () => import('../types/game').RunNodeType | null;
  getPreviewNode: () => import('../types/game').IncursionNode | null;
  startBadgeTestCombat: (preset: 'easy' | 'hard', config: BadgeTestCombatConfig) => void;
  startDevSandboxNode: (preset: DevSandboxPreset, config: BadgeTestCombatConfig) => void;
  finishBadgeTestCombat: () => void;
  finishDevSandbox: () => void;
  /** Clears run or badge test combat (caller navigates to hub / badge). */
  exitCombatToBadge: () => void;
  useIncursionConsumable: (itemId: CargoItemId) => IncursionConsumableUseResult | null;
  /** Applies consumable heal to run state (non-combat screens). */
  applyIncursionConsumableHeal: (amount: number) => void;
  awardRunCredits: (amount: number, reason: string) => void;
  setAegisLoadout: (loadout: AegisLoadout) => void;
  setHexShotLoadout: (loadout: HexShotLoadout) => void;
  setEnvoyLoadout: (loadout: EnvoyLoadout) => void;
  purchaseBlackMarketCargo: (itemId: CargoItemId) => { success: boolean; logLine: string } | null;
  purchaseBlackMarketCargoAtCell: (
    itemId: CargoItemId,
    row: number,
    col: number,
  ) => { success: boolean; logLine: string } | null;
  returnStagedBlackMarketCargo: (instanceId: string) => { success: boolean; logLine: string } | null;
  commitBlackMarketBindings: () => { success: boolean; logLine: string } | null;
  sellPlacedCargoToBlackMarket: (instanceId: string) => { success: boolean; logLine: string } | null;
  revertBlackMarketStaging: () => void;
  stageSafeAnchorReview: (anchorIndex: 1 | 2 | 3) => void;
  confirmSafeAnchorExtraction: (anchorIndex: 1 | 2 | 3) => void;
  continueFromExtractionReview: () => void;
  adjustResonance: (amount: number, reason: string) => number;
  applyResonanceManifestScan: (nodeId: string) => void;
  initiateEmergencyRecall: () => boolean;
  completeDefendRiftVictory: () => void;
  confirmMasterExtraction: () => void;
  applyEmergencyRecallCargoBleed: () => number;
  refreshOverworldFeatures: () => void;
  tickOverworldHazards: (
    player: { x: number; y: number },
    deltaMs: number,
  ) => { gridHoundCaught: boolean };
  collectVeilEcho: (echoId: string) => boolean;
  acquireRawLeyBoon: (boonId: string) => boolean;
  fireDirectedPing: (facing: AegisFacing) => void;
  swapLeyLineMutation: (outgoingId: LeyLineMutationId) => void;
  cancelLeyBoonSwap: () => void;
  swapClassBoon: (outgoingId: string) => void;
  cancelClassBoonSwap: () => void;
  prepareGridHoundEncounter: () => void;
}

const RunContext = createContext<RunContextType | undefined>(undefined);

function persistExpandedSectorGraph(inc: ActiveIncursionState): ActiveIncursionState {
  const resolvedNodeId = resolveScannerGraphNodeId(inc.sectorGraph, inc.currentNodeId);
  const expandedGraph = ensureForwardVectorsOnGraph(inc.sectorGraph, resolvedNodeId);
  if (Object.keys(expandedGraph.nodes).length === Object.keys(inc.sectorGraph.nodes).length) {
    return inc;
  }
  return { ...inc, sectorGraph: expandedGraph };
}

function activateGridHoundOnIncursion(inc: ActiveIncursionState): ActiveIncursionState {
  if (inc.overworldSession.gridHound?.active) return inc;
  const anchor = { x: SCOUT_ARENA_WIDTH / 2, y: SCOUT_ARENA_HEIGHT - 72 };
  const hound = createGridHound(anchor, { width: SCOUT_ARENA_WIDTH, height: SCOUT_ARENA_HEIGHT });
  return {
    ...inc,
    overworldSession: { ...inc.overworldSession, gridHound: hound },
  };
}

function buildSectorCluster(inc: ActiveIncursionState): IncursionNode[] {
  if (isProceduralRunActive(inc)) {
    const prepared = prepareProceduralScannerIncursion(inc);
    return buildProceduralScannerCluster(prepared);
  }
  if (!inc.sectorGraph.entryId) return [];
  const clusterOptions = {
    graph: inc.sectorGraph,
    currentNodeId: resolveScannerGraphNodeId(inc.sectorGraph, inc.currentNodeId),
    nodesCleared: inc.nodesCleared,
    resonancePercent: inc.resonance.percent,
    bossDefeated: inc.bossDefeated,
    greedZoneActive: getGreedZoneActive(inc.nodesCleared),
    clearedSafeAnchors: inc.clearedSafeAnchors,
    collapseActive: inc.collapseActive,
    masterLinkUsed: inc.masterLinkUsed,
    extractionDecoyPending: inc.resonanceEscalations.extractionDecoyPending,
    relayExtractionNodeId: inc.resonanceEscalations.relayExtractionNodeId,
    macroBiomeFamily: inc.currentMacroBiomeFamily,
    lastLevelOfferedCombat: inc.lastLevelOfferedCombat,
    sanctuarySchedule: inc.sanctuarySchedule,
    runSegment: inc.runSegment,
  };
  if (inc.nodesCleared >= MAX_SECTOR_NODES && !inc.collapseActive && !inc.bossDefeated) {
    return buildScannerCluster(clusterOptions).filter((node) => node.isExtractionNode);
  }
  return buildScannerCluster(clusterOptions);
}

function resolveActiveVectorNode(inc: ActiveIncursionState): IncursionNode | null {
  if (inc.selectedVectorId) {
    const found = findVectorInCluster(buildSectorCluster(inc), inc.selectedVectorId);
    if (found) return found;
  }
  return inc.encounterPath[inc.nodesCleared] ?? inc.encounterPath[inc.currentEncounterIndex] ?? null;
}

function aggregateModifiers(trinkets: Trinket[]) {
  return trinkets.reduce(
    (acc, t) => ({
      parryWindowBonus: acc.parryWindowBonus + (t.parryWindowBonus ?? 0),
      parryMultiplierBonus: acc.parryMultiplierBonus + (t.parryMultiplierBonus ?? 0),
      sliceDamagePenalty: acc.sliceDamagePenalty + (t.sliceDamagePenalty ?? 0),
      startingAbyssalReservePercent: Math.max(acc.startingAbyssalReservePercent, t.startingAbyssalReservePercent ?? 0),
    }),
    { parryWindowBonus: 0, parryMultiplierBonus: 0, sliceDamagePenalty: 0, startingAbyssalReservePercent: 0 },
  );
}

function createInitialRunState(): RunState {
  return {
    runActive: false,
    currentNode: 0,
    totalNodes: TOTAL_RUN_NODES,
    maxStamina: BASE_MAX_STAMINA,
    currentStamina: BASE_MAX_STAMINA,
    maxSoulAnchor: BASE_MAX_SOUL_ANCHOR,
    soulAnchorIntegrity: BASE_MAX_SOUL_ANCHOR,
    climateCluster: null,
    currentSector: null,
    activeTrinkets: [],
    pendingEncounter: null,
    pendingEnemy: null,
    pendingEnemies: [],
    pendingAmbush: false,
    parryWindowBonus: 0,
    parryMultiplierBonus: 0,
    sliceDamagePenalty: 0,
    startingAbyssalReservePercent: 0,
    combatNodesCleared: 0,
    combatTestPreset: null,
    devSandboxPreset: null,
  };
}

export function RunProvider({ children }: { children: React.ReactNode }) {
  const { transferVeilResidueIntoRun, restoreVeilResidueBaseline, persistRunBankedSnapshot } = usePlayerAccount();
  const [runState, setRunState] = useState<RunState>(createInitialRunState);
  const runStateRef = useRef<RunState>(runState);
  const [runLog, setRunLog] = useState<string[]>([]);
  const combatLogActiveRef = useRef(false);
  const pendingRunLogsRef = useRef<string[]>([]);
  const runLogFlushScheduledRef = useRef(false);
  const [scanSessionKey, setScanSessionKey] = useState(0);
  const scanSessionKeyRef = useRef(scanSessionKey);
  scanSessionKeyRef.current = scanSessionKey;
  const pocketResonanceAccumRef = useRef(0);
  const [postCombatMutationChoices, setPostCombatMutationChoices] = useState<PostCombatBoonOffer[]>([]);
  const [boundRequisitionOffers, setBoundRequisitionOffers] = useState<BoundRequisitionDefinition[]>([]);
  const [activeIncursion, setActiveIncursion] = useState<ActiveIncursionState>(
    createDefaultActiveIncursionState,
  );
  const activeIncursionRef = useRef<ActiveIncursionState>(activeIncursion);
  const narrativeNodeRef = useRef<NarrativeEventNode | null>(null);
  const narrativeAssemblyRef = useRef<ProceduralNarrativeAssembly | null>(null);
  const runStartedAtMsRef = useRef<number | null>(null);
  const lastKillingEnemyRef = useRef<string | null>(null);
  const operationContributionApplierRef = useRef<
    ((operationId: string, amount: number) => Promise<void>) | null
  >(null);
  const [deathSummary, setDeathSummary] = useState<RunDeathSummary | null>(null);

  runStateRef.current = runState;
  activeIncursionRef.current = activeIncursion;

  const setCombatLogActive = useCallback((active: boolean) => {
    combatLogActiveRef.current = active;
  }, []);

  const clearRunLog = useCallback(() => {
    pendingRunLogsRef.current = [];
    runLogFlushScheduledRef.current = false;
    setRunLog([]);
  }, []);

  const beginCombatRunLogSession = useCallback(() => {
    combatLogActiveRef.current = true;
    pendingRunLogsRef.current = [];
    runLogFlushScheduledRef.current = false;
    setRunLog([]);
  }, []);

  const flushPendingRunLogs = useCallback(() => {
    runLogFlushScheduledRef.current = false;
    const batch = pendingRunLogsRef.current;
    pendingRunLogsRef.current = [];
    if (batch.length === 0) return;
    setRunLog((prev) => [...prev, ...batch]);
  }, []);

  const appendRunLog = useCallback((text: string) => {
    if (!combatLogActiveRef.current) return;
    pendingRunLogsRef.current.push(text);
    if (runLogFlushScheduledRef.current) return;
    runLogFlushScheduledRef.current = true;
    queueMicrotask(flushPendingRunLogs);
  }, [flushPendingRunLogs]);

  const recordRunKillAttacker = useCallback((designation: string) => {
    lastKillingEnemyRef.current = designation;
  }, []);

  const startNewRun = useCallback((config?: RunStartConfig) => {
    runStartedAtMsRef.current = Date.now();
    lastKillingEnemyRef.current = null;
    setDeathSummary(null);
    const cluster = pickRandomClimateCluster();
    const clusterDef = getClusterDefinition(cluster);
    const hpBonus = config?.factionPerks?.maxHpBonus ?? 0;
    const shadowHpBonus = config?.runModifiers?.maxHpBonusPct ?? 0;
    const stamBonus = config?.factionPerks?.maxStaminaBonus ?? 0;
    const maxSoulAnchor = Math.floor((BASE_MAX_SOUL_ANCHOR + hpBonus) * (1 + shadowHpBonus / 100));
    const maxStamina = BASE_MAX_STAMINA + stamBonus;
    const citySector = INITIAL_SECTOR_POOL.find((s) => s.id === 'city-subway') ?? INITIAL_SECTOR_POOL[0];
    const next: RunState = {
      ...createInitialRunState(),
      runActive: true,
      climateCluster: cluster,
      currentSector: citySector,
      maxSoulAnchor,
      soulAnchorIntegrity: maxSoulAnchor,
      maxStamina,
      currentStamina: maxStamina,
    };
    runStateRef.current = next;
    setRunState(next);
    const sectorTier = config?.sectorTier ?? 1;
    const runSeed = `run:${Date.now()}:${sectorTier}`;
    const runSectorId = config?.runGenerationContext?.sectorState.id;
    const runVeilBiome = runSectorId ? sectorIdToVeilBiome(runSectorId) : null;
    const lockedMacroBiome = runSectorId ? sectorIdToLegacyMacroBiome(runSectorId) : null;
    const sectorInit = initializeSectorRun(sectorTier, config?.alignedFaction ?? null, {
      runGenerationContext: config?.runGenerationContext ?? null,
      treeSeed: runSeed,
      depthIndex: 1,
    });
    const sanctuarySchedule = rollSanctuarySchedule(`run:${Date.now()}:${sectorTier}`);
    const initialRunSegment = createRunSegment(1, runSeed);
    const startingCanisterResidue = resolveStartingRunCanisterResidue(
      config?.startingVeilResidueBalance ?? 0,
    );
    const starterCargo = applyIncursionStarterCargo(config?.initialCargo ?? createStarterCargoRunState());
    const incursion: ActiveIncursionState = {
      ...createDefaultActiveIncursionState(),
      isRunActive: true,
      inventory: createDefaultIncursionInventory(),
      currentDepth: 1,
      currentDistrict: 1,
      resonanceManifestNodeIds: [],
      currentEncounterIndex: 0,
      progress: sectorInit.progress,
      encounterPath: sectorInit.encounterPath,
      encounterOptionClusters: [],
      earlySanctuarySpawned: false,
      selectedVectorId: null,
      previewNodeId: null,
      scanConfirmOverlayVisible: false,
      mapMode: 'SCANNING_HUB',
      lastCheckpointMessage: null,
      runCredits: 0,
      sectorGraph: sectorInit.sectorGraph,
      proceduralRunTree: sectorInit.proceduralRunTree,
      revealedSonarNodeIds: [],
      pendingProceduralResourcePool: [],
      currentNodeId: sectorInit.currentNodeId,
      nodesCleared: sectorInit.nodesCleared,
      attunement: sectorInit.attunement,
      resonance: sectorInit.resonance,
      focusedNodeIds: sectorInit.focusedNodeIds,
      bossDefeated: sectorInit.bossDefeated,
      primeExtractionBonus: sectorInit.primeExtractionBonus,
      sectorTier: sectorInit.sectorTier,
      leyLineMutations: [],
      hexShotBoons: [],
      envoyBoons: [],
      alignedFaction: config?.alignedFaction ?? null,
      runVeilBiome,
      currentMacroBiomeFamily: lockedMacroBiome,
      lastMacroBiomeFamily: null,
      pendingDistrictBiomeOffers: null,
      awaitingDistrictBiomeChoice: false,
      depth1MacroBiomeChoice: lockedMacroBiome,
      runStatusEffects: [],
      overworldSession: generateOverworldFeatures(
        0,
        1,
        `run-start:${sectorTier}`,
        { width: SCOUT_ARENA_WIDTH, height: SCOUT_ARENA_HEIGHT },
        null,
        0,
        {
          activeClass: config?.activeClass ?? 'AEGIS',
          leyLineMutations: [],
          hexShotBoons: [],
          envoyBoons: [],
        },
      ),
      pendingLeyBoonSwap: null,
      pendingClassBoonSwap: null,
      blackMarketStock: [],
      aegisLoadout: config?.aegisLoadout
        ? [...config.aegisLoadout] as AegisLoadout
        : createDefaultActiveIncursionState().aegisLoadout,
      hexShotLoadout: config?.hexShotLoadout
        ? sanitizeHexShotCombatLoadout(config.hexShotLoadout)
        : createDefaultActiveIncursionState().hexShotLoadout,
      envoyLoadout: config?.envoyLoadout
        ? sanitizeEnvoyCombatLoadout(config.envoyLoadout)
        : createDefaultActiveIncursionState().envoyLoadout,
      activeClass: config?.activeClass ?? 'AEGIS',
      cargo: starterCargo,
      sanctuarySchedule,
      strikeDamageBonusPct: 0,
      runModifiers: config?.runModifiers ?? {
        maxHpBonusPct: 0,
        kineticArmorBonus: 0,
        rareLootBonusPct: 0,
        blackMarketDiscountPct: 0,
        firstTurnApBonus: 0,
      },
      runGenerationContext: config?.runGenerationContext ?? null,
      activeContract: config?.runGenerationContext?.activeContract ?? null,
      contractRunProgress: createInitialContractRunProgress(),
      runSegment: initialRunSegment,
      unstableCargoPickupLogged: [],
      unstableCargoEffectsSeen: mergeUnstableCargoEffectsSeen([], starterCargo),
      sessionVeilResidueCollected: startingCanisterResidue,
      runVeilResidueBaseline: startingCanisterResidue,
    };
    const expandedIncursion = persistExpandedSectorGraph(incursion);
    activeIncursionRef.current = expandedIncursion;
    setActiveIncursion(expandedIncursion);
    if (startingCanisterResidue > 0) {
      transferVeilResidueIntoRun(startingCanisterResidue);
    }
    narrativeNodeRef.current = null;
    narrativeAssemblyRef.current = null;
    narrativeAssemblyRef.current = null;
    resetCargoInstanceCounter();
    setScanSessionKey(1);
    setPostCombatMutationChoices([]);
    setBoundRequisitionOffers([]);
    combatLogActiveRef.current = false;
    const initialLog: string[] = [];
    if (startingCanisterResidue > 0) {
      initialLog.push(`>> VEIL RESIDUE CANISTER PRELOADED — ${startingCanisterResidue} UNITS FROM CABAL VAULT.`);
    }
    if (runVeilBiome && lockedMacroBiome) {
      initialLog.push(`>> VEIL BIOME LOCKED — ${veilBiomeDisplayName(runVeilBiome).toUpperCase()}.`);
      initialLog.push(formatMacroBiomeLogLine(lockedMacroBiome));
      initialLog.push(`>> ${getMacroBiomeContextLog(lockedMacroBiome)}`);
    }
    setRunLog(initialLog);
  }, [transferVeilResidueIntoRun]);

  const refreshOverworldFeatures = useCallback(() => {
    const inc = activeIncursionRef.current;
    const session = generateOverworldFeatures(
      inc.nodesCleared,
      inc.currentDistrict,
      `ow-${scanSessionKeyRef.current}-${inc.nodesCleared}`,
      { width: SCOUT_ARENA_WIDTH, height: SCOUT_ARENA_HEIGHT },
      inc.overworldSession.gridHound,
      inc.overworldSession.rawBoonsClaimedThisDistrict,
      {
        activeClass: inc.activeClass ?? 'AEGIS',
        leyLineMutations: inc.leyLineMutations,
        hexShotBoons: inc.hexShotBoons,
        envoyBoons: inc.envoyBoons,
      },
    );
    setActiveIncursion((prev) => {
      const next = { ...prev, overworldSession: session };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const beginScanSession = useCallback(() => {
    setScanSessionKey((k) => k + 1);
    setTimeout(() => refreshOverworldFeatures(), 0);
  }, [refreshOverworldFeatures]);

  const prepareBoundRequisitionOffers = useCallback((account: PlayerAccount) => {
    const inc = activeIncursionRef.current;
    const offers = rollBoundRequisitionOffers(account, inc.alignedFaction);
    setBoundRequisitionOffers(offers);
  }, []);

  const confirmBoundRequisition = useCallback((
    id: BoundRequisitionId,
    craftedAugments: readonly BoundRequisitionId[] = [],
  ) => {
    const run = runStateRef.current;
    const inc = activeIncursionRef.current;
    const result = applyBoundRequisitionAtRunStart(id, run, inc);
    const mergedRun = { ...run, ...result.runPatch };
    const mergedInc = { ...inc, ...result.incursionPatch };
    const primaryRuntime = mergedInc.boundRequisition ?? buildBoundRequisitionRuntime(id);
    const passiveResult = applyCraftedAugmentPassives(
      craftedAugments,
      id,
      mergedRun,
      mergedInc,
      primaryRuntime,
    );

    const nextRun = { ...mergedRun, ...passiveResult.runPatch };
    if (Object.keys({ ...result.runPatch, ...passiveResult.runPatch }).length > 0) {
      runStateRef.current = nextRun;
      setRunState(nextRun);
    }

    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        ...result.incursionPatch,
        ...passiveResult.incursionPatch,
      };
      activeIncursionRef.current = next;
      return next;
    });

    [...result.logLines, ...passiveResult.logLines].forEach((line) => appendRunLog(line));
    setBoundRequisitionOffers([]);
  }, [appendRunLog]);

  const consumeAdrenalinePrimerAfterCombat = useCallback(() => {
    const inc = activeIncursionRef.current;
    const req = inc.boundRequisition;
    if (!req || req.adrenalinePrimerCombatsRemaining <= 0) return;

    const nextReq = consumeAdrenalinePrimerCombat(req);
    setActiveIncursion((prev) => {
      const next = { ...prev, boundRequisition: nextReq };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog('>> ADRENALINE PRIMER SPENT — COMBAT CHARGE CONSUMED.');
  }, [appendRunLog]);

  const peekPendingNarrativeCombatBoons = useCallback((): PendingNarrativeCombatBoons => {
    const inc = activeIncursionRef.current;
    const pending = { ...inc.pendingNarrativeCombatBoons };
    if (
      !pending.ghosted
      && !pending.scouted
      && !pending.overcharged
      && !pending.veilWard
    ) {
      return createDefaultPendingNarrativeCombatBoons();
    }
    return pending;
  }, []);

  const clearPendingNarrativeCombatBoons = useCallback(() => {
    const inc = activeIncursionRef.current;
    const pending = inc.pendingNarrativeCombatBoons;
    if (
      !pending.ghosted
      && !pending.scouted
      && !pending.overcharged
      && !pending.veilWard
    ) {
      return;
    }
    queueMicrotask(() => {
      setActiveIncursion((prev) => {
        const next = {
          ...prev,
          pendingNarrativeCombatBoons: createDefaultPendingNarrativeCombatBoons(),
        };
        activeIncursionRef.current = next;
        return next;
      });
    });
  }, []);

  const claimPendingNarrativeCombatBoons = useCallback((): PendingNarrativeCombatBoons => {
    const claimed = peekPendingNarrativeCombatBoons();
    clearPendingNarrativeCombatBoons();
    return claimed;
  }, [clearPendingNarrativeCombatBoons, peekPendingNarrativeCombatBoons]);

  const clearNarrativeBoonStatusEffects = useCallback(() => {
    setActiveIncursion((prev) => {
      const nextEffects = stripNarrativeBoonStatusEffects(prev.runStatusEffects);
      if (nextEffects.length === prev.runStatusEffects.length) return prev;
      const next = { ...prev, runStatusEffects: nextEffects };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const isPostCombatBoonBlocked = useCallback((): boolean => {
    const inc = activeIncursionRef.current;
    if (isLeyScarAcquisitionBlocked(inc)) return true;
    const node = resolveActiveVectorNode(inc);
    return node?.type !== 'ELITE_COMBAT';
  }, []);

  const applyTrinket = useCallback((trinket: Trinket) => {
    setRunState((prev) => {
      const activeTrinkets = [...prev.activeTrinkets, trinket];
      const mods = aggregateModifiers(activeTrinkets);
      let maxSoulAnchor = prev.maxSoulAnchor;
      let maxStamina = prev.maxStamina;
      let soulAnchorIntegrity = prev.soulAnchorIntegrity;
      let currentStamina = prev.currentStamina;

      if (trinket.maxHpBonus) {
        maxSoulAnchor += trinket.maxHpBonus;
        soulAnchorIntegrity += trinket.maxHpBonus;
      }
      if (trinket.maxStaminaBonus) {
        maxStamina += trinket.maxStaminaBonus;
        currentStamina += trinket.maxStaminaBonus;
      }
      if (trinket.hpRestore) {
        soulAnchorIntegrity = Math.min(soulAnchorIntegrity + trinket.hpRestore, maxSoulAnchor);
      }
      if (trinket.staminaRestore) {
        currentStamina = Math.min(currentStamina + trinket.staminaRestore, maxStamina);
      }

      const next = {
        ...prev,
        activeTrinkets,
        maxSoulAnchor,
        maxStamina,
        soulAnchorIntegrity,
        currentStamina,
        ...mods,
      };
      runStateRef.current = next;
      return next;
    });
    appendRunLog(`>> Trinket acquired: ${trinket.name} — ${trinket.effect}`);
  }, [appendRunLog]);

  const commitRadarDot = useCallback((dot: RadarDot): EncounterNode => {
    const prev = runStateRef.current;
    const nodeIndex = activeIncursionRef.current.currentEncounterIndex;
    const encounter = buildEncounter(nodeIndex, dot.sector, dot.encounterType, dot.label);
    const pendingEnemies =
      dot.encounterType === 'COMBAT'
        ? spawnCombatSquad({
          nodeIndex,
          isAmbush: prev.pendingAmbush,
          district: getDistrictFromDepth(depthFromNodesCleared(nodeIndex)),
          runSegment: activeIncursionRef.current.runSegment,
          macroBiome: activeIncursionRef.current.currentMacroBiomeFamily,
          veilBiome: activeIncursionRef.current.runVeilBiome,
        })
        : [];
    const pendingEnemy = pendingEnemies[0] ?? null;

    const next: RunState = {
      ...prev,
      climateCluster: prev.climateCluster ?? 'URBAN',
      currentSector: dot.sector,
      pendingEncounter: encounter,
      pendingEnemy,
      pendingEnemies,
    };
    runStateRef.current = next;
    setRunState(next);

    appendRunLog(`>> ${dot.pingLabel} — incursion vector confirmed.`);
    if (pendingEnemy) {
      appendRunLog(`>> Hostile signature: ${pendingEnemy.designation} [${pendingEnemy.class}] HP ${pendingEnemy.maxHp}.`);
    }
    return encounter;
  }, [appendRunLog]);

  const incrementCombatNodesCleared = useCallback(() => {
    setRunState((prev) => {
      const next = { ...prev, combatNodesCleared: prev.combatNodesCleared + 1 };
      runStateRef.current = next;
      return next;
    });
  }, []);

  const getCurrentEncounter = useCallback((): EncounterNode | null => {
    return runStateRef.current.pendingEncounter;
  }, []);

  const getCurrentSkillCheck = useCallback((): SkillCheckEvent | null => {
    const theme = runStateRef.current.currentSector?.theme ?? 'CITY';
    const pool = getThemedSkillChecks(theme);
    return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
  }, []);

  const advanceNode = useCallback(() => {
    const prev = runStateRef.current;
    const nextCompleted = prev.currentNode + 1;
    const hasNext = nextCompleted < TOTAL_RUN_NODES;
    const nextState: RunState = {
      ...prev,
      currentNode: nextCompleted,
      pendingEncounter: null,
      pendingEnemy: null,
      pendingEnemies: [],
    };
    runStateRef.current = nextState;
    setRunState(nextState);
    return { hasNext, completedCount: nextCompleted };
  }, []);

  const applyLeyLineMutation = useCallback((mutationId: LeyLineMutationId) => {
    const inc = activeIncursionRef.current;
    if (isLeyScarAcquisitionBlocked(inc)) {
      appendRunLog('>> LEY-SCAR ACQUISITION BLOCKED — IRONCLAD LOGISTICS MANDATE ACTIVE.');
      return;
    }
    if (inc.leyLineMutations.length >= MAX_LEY_MUTATIONS) {
      setActiveIncursion((prev) => {
        const next = {
          ...prev,
          pendingLeyBoonSwap: { incomingMutationId: mutationId } satisfies PendingLeyBoonSwap,
        };
        activeIncursionRef.current = next;
        return next;
      });
      appendRunLog('>> LEY-LINE CAP REACHED — swap required to accept incoming boon.');
      return;
    }
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        leyLineMutations: [...prev.leyLineMutations, mutationId],
      };
      activeIncursionRef.current = next;
      return next;
    });
    if (mutationId === 'HYPER_METABOLISM') {
      setRunState((prev) => {
        const maxSoulAnchor = Math.max(1, Math.floor(prev.maxSoulAnchor * 0.75));
        const soulAnchorIntegrity = Math.min(prev.soulAnchorIntegrity, maxSoulAnchor);
        const next = { ...prev, maxSoulAnchor, soulAnchorIntegrity };
        runStateRef.current = next;
        return next;
      });
    }
    appendRunLog(`>> Ley-Line mutation secured: ${mutationId.replace(/_/g, ' ')}.`);
  }, [appendRunLog]);

  const applyHexShotBoon = useCallback((boonId: HexShotBoonId) => {
    const inc = activeIncursionRef.current;
    if (isLeyScarAcquisitionBlocked(inc)) {
      appendRunLog('>> LEY-SCAR ACQUISITION BLOCKED — IRONCLAD LOGISTICS MANDATE ACTIVE.');
      return;
    }
    if (inc.hexShotBoons.length >= MAX_LEY_MUTATIONS) {
      setActiveIncursion((prev) => {
        const next = {
          ...prev,
          pendingClassBoonSwap: {
            classId: 'HEX_SHOT' as const,
            incomingBoonId: boonId,
          },
        };
        activeIncursionRef.current = next;
        return next;
      });
      appendRunLog('>> HEX-SHOT BOON CAP REACHED — swap required to accept incoming boon.');
      return;
    }
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        hexShotBoons: [...prev.hexShotBoons, boonId],
      };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog(`>> Hex-Shot boon secured: ${getClassBoonDisplayName('HEX_SHOT', boonId)}.`);
  }, [appendRunLog]);

  const applyEnvoyBoon = useCallback((boonId: EnvoyBoonId) => {
    const inc = activeIncursionRef.current;
    if (isLeyScarAcquisitionBlocked(inc)) {
      appendRunLog('>> LEY-SCAR ACQUISITION BLOCKED — IRONCLAD LOGISTICS MANDATE ACTIVE.');
      return;
    }
    if (inc.envoyBoons.length >= MAX_LEY_MUTATIONS) {
      setActiveIncursion((prev) => {
        const next = {
          ...prev,
          pendingClassBoonSwap: {
            classId: 'ENVOY' as const,
            incomingBoonId: boonId,
          },
        };
        activeIncursionRef.current = next;
        return next;
      });
      appendRunLog('>> ENVOY BOON CAP REACHED — swap required to accept incoming boon.');
      return;
    }
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        envoyBoons: [...prev.envoyBoons, boonId],
      };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog(`>> Envoy boon secured: ${getClassBoonDisplayName('ENVOY', boonId)}.`);
  }, [appendRunLog]);

  const completeNodeAfterMutation = useCallback((boonId: string) => {
    const inc = activeIncursionRef.current;
    if (inc.activeClass === 'HEX_SHOT') {
      applyHexShotBoon(boonId as HexShotBoonId);
    } else if (inc.activeClass === 'ENVOY') {
      applyEnvoyBoon(boonId as EnvoyBoonId);
    } else {
      applyLeyLineMutation(boonId as LeyLineMutationId);
    }
    setPostCombatMutationChoices([]);
  }, [applyEnvoyBoon, applyHexShotBoon, applyLeyLineMutation]);

  const rollBlackMarketStockForNode = useCallback(() => {
    const stock = rollBlackMarketStock();
    setActiveIncursion((prev) => {
      const next = { ...prev, blackMarketStock: stock };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog(`>> BLACK MARKET STOCK — ${stock.length} listings available.`);
  }, [appendRunLog]);

  const syncAfterCombat = useCallback((remainingHp: number, remainingStamina: number) => {
    setRunState((prev) => {
      const godMode = activeIncursionRef.current.godModeActive;
      const next = {
        ...prev,
        soulAnchorIntegrity: godMode
          ? prev.maxSoulAnchor
          : Math.min(Math.max(remainingHp, 0), prev.maxSoulAnchor),
        currentStamina: godMode
          ? prev.maxStamina
          : Math.min(Math.max(remainingStamina, 0), prev.maxStamina),
        pendingEnemy: null,
        pendingEnemies: [],
        pendingEncounter: null,
      };
      runStateRef.current = next;
      return next;
    });
  }, []);

  const refillStaminaAfterCombat = useCallback(() => {
    setRunState((prev) => {
      const next = { ...prev, currentStamina: prev.maxStamina };
      runStateRef.current = next;
      return next;
    });
    appendRunLog('>> Combat node cleared — stamina reserves fully replenished.');
  }, [appendRunLog]);

  const preparePostCombatMutations = useCallback((): PostCombatBoonOffer[] => {
    const inc = activeIncursionRef.current;
    if (isLeyScarAcquisitionBlocked(inc)) {
      setPostCombatMutationChoices([]);
      appendRunLog('>> LEY-SCAR BOON SKIPPED — IRONCLAD LOGISTICS MANDATE ACTIVE.');
      return [];
    }
    const node = resolveActiveVectorNode(inc);
    if (node?.type !== 'ELITE_COMBAT') {
      setPostCombatMutationChoices([]);
      return [];
    }
    const choices = preparePostCombatBoonOffers(
      inc.activeClass,
      inc.leyLineMutations,
      inc.hexShotBoons,
      inc.envoyBoons,
      3,
    );
    setPostCombatMutationChoices(choices);
    return choices;
  }, [appendRunLog]);

  const applySkillCheckTier = useCallback((tier: 'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'CRITICAL_DESYNC', logLine: string) => {
    setRunState((prev) => {
      let maxStamina = prev.maxStamina;
      let maxSoulAnchor = prev.maxSoulAnchor;
      let soulAnchorIntegrity = prev.soulAnchorIntegrity;
      let currentStamina = prev.currentStamina;
      let pendingAmbush = prev.pendingAmbush;
      let activeTrinkets = prev.activeTrinkets;

      switch (tier) {
        case 'CRITICAL_SUCCESS': {
          soulAnchorIntegrity = Math.min(soulAnchorIntegrity + 30, maxSoulAnchor);
          const trinket = pickRandomTrinkets(TRINKET_POOL, 1)[0];
          if (trinket) activeTrinkets = [...activeTrinkets, trinket];
          break;
        }
        case 'SUCCESS':
          maxStamina += 10;
          currentStamina = Math.min(currentStamina + 20, maxStamina);
          break;
        case 'FAILURE':
          soulAnchorIntegrity = Math.max(soulAnchorIntegrity - 15, 0);
          maxStamina = Math.max(maxStamina - 30, 20);
          currentStamina = Math.min(currentStamina, maxStamina);
          break;
        case 'CRITICAL_DESYNC':
          soulAnchorIntegrity = Math.max(soulAnchorIntegrity - 25, 0);
          if (AMBUSH_ENCOUNTERS_ENABLED) pendingAmbush = true;
          break;
        default:
          break;
      }

      const mods = aggregateModifiers(activeTrinkets);
      const next = {
        ...prev,
        maxStamina,
        maxSoulAnchor,
        soulAnchorIntegrity,
        currentStamina,
        pendingAmbush,
        activeTrinkets,
        ...mods,
      };
      runStateRef.current = next;
      return next;
    });
    appendRunLog(logLine);
  }, [appendRunLog]);

  const applySanctuaryAttune = useCallback(() => {
    setRunState((prev) => {
      const inc = activeIncursionRef.current;
      const survivalist = inc.activeClass === 'HEX_SHOT'
        && inc.hexShotBoons.includes('SURVIVALIST');
      const boonMultiplier = survivalist ? 1.5 : 1;
      const restore = Math.floor(
        prev.maxSoulAnchor * 0.30 * boonMultiplier * resolveCargoHealReceivedMultiplier(inc.cargo),
      );
      const next = {
        ...prev,
        soulAnchorIntegrity: Math.min(prev.soulAnchorIntegrity + restore, prev.maxSoulAnchor),
      };
      runStateRef.current = next;
      return next;
    });
    const survivalist = activeIncursionRef.current.activeClass === 'HEX_SHOT'
      && activeIncursionRef.current.hexShotBoons.includes('SURVIVALIST');
    appendRunLog(
      survivalist
        ? '>> SANCTUARY ATTUNE — 30% soul anchor restored (+50% Survivalist).'
        : '>> SANCTUARY ATTUNE — 30% soul anchor integrity restored.',
    );
  }, [appendRunLog]);

  const getVeilResidueBalance = useCallback((): number => {
    return activeIncursionRef.current.sessionVeilResidueCollected;
  }, []);

  const openSanctuaryGraftTerminal = useCallback(() => {
    const inc = activeIncursionRef.current;
    const classId = inc.activeClass ?? 'AEGIS';
    const offers = rollClassGraftOffers(classId, 3);
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        sanctuaryGraftOffers: offers,
      };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog(`>> ${classId} GRAFT TERMINAL ONLINE — three volatile mutations staged.`);
    offers.forEach((graftId) => {
      const graft = getClassGraftDefinition(classId, graftId);
      appendRunLog(`>> — OFFER: ${graft.name.toUpperCase()} (${graft.cost} RESIDUE)`);
    });
  }, [appendRunLog]);

  const applyClassGraftToAbility = useCallback((
    abilityId: string,
    graftId: string,
  ): { success: boolean; message: string } => {
    const inc = activeIncursionRef.current;
    const classId = inc.activeClass ?? 'AEGIS';

    if (!canGraftClassAbility(classId, abilityId)) {
      return { success: false, message: 'This ability slot cannot be grafted.' };
    }

    const graft = getClassGraftDefinition(classId, graftId);
    if (inc.sessionVeilResidueCollected < graft.cost) {
      return { success: false, message: 'Insufficient Veil Residue.' };
    }

    if (graft.reduceMaxHp != null) {
      setRunState((runPrev) => {
        const nextMaxHp = Math.max(1, Math.floor(runPrev.maxSoulAnchor * (1 - graft.reduceMaxHp!)));
        const runNext = {
          ...runPrev,
          maxSoulAnchor: nextMaxHp,
          soulAnchorIntegrity: Math.min(runPrev.soulAnchorIntegrity, nextMaxHp),
        };
        runStateRef.current = runNext;
        return runNext;
      });
    }

    setActiveIncursion((prev) => {
      const graftPatch = classId === 'HEX_SHOT'
        ? {
          hexShotAbilityGrafts: {
            ...prev.hexShotAbilityGrafts,
            [abilityId]: graftId,
          },
        }
        : classId === 'ENVOY'
          ? {
            envoyAbilityGrafts: {
              ...prev.envoyAbilityGrafts,
              [abilityId]: graftId,
            },
          }
          : {
            abilityGrafts: {
              ...prev.abilityGrafts,
              [abilityId as import('../types/aegisCombat').AegisAbilityId]: graftId as import('../types/veilGraft').VeilGraftId,
            },
          };

      const next = {
        ...prev,
        sessionVeilResidueCollected: prev.sessionVeilResidueCollected - graft.cost,
        ...graftPatch,
        encounterUltimateDisabled: graft.disableUltimate === true
          ? true
          : prev.encounterUltimateDisabled,
      };
      activeIncursionRef.current = next;
      return next;
    });

    const abilityLabel = abilityId.replace(/_/g, ' ');
    appendRunLog(`>> GRAFT APPLIED — ${graft.name.toUpperCase()} fused to ${abilityLabel}. (−${graft.cost} RESIDUE)`);
    if (graft.reduceMaxHp != null) {
      appendRunLog(`>> MARTYR TAX — max soul anchor reduced by ${Math.round(graft.reduceMaxHp * 100)}%.`);
    }
    if (graft.disableUltimate) {
      appendRunLog('>> APEX MUTATION — ultimate channel sealed for next combat encounter.');
    }

    return { success: true, message: `${graft.name} applied.` };
  }, [appendRunLog]);

  const clearEncounterUltimateDisabled = useCallback(() => {
    setActiveIncursion((prev) => {
      if (!prev.encounterUltimateDisabled) return prev;
      const next = { ...prev, encounterUltimateDisabled: false };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const endRun = useCallback((reason: string) => {
    const inc = activeIncursionRef.current;
    const isRunFailure =
      reason.includes('DESTROYED')
      || reason.includes('DEFEATED')
      || reason.includes('FAILED');
    const extractionSecured = reason.includes('SECTOR EXTRACTION SECURED');
    if (
      inc.isRunActive
      && !extractionSecured
      && (isRunFailure || reason.includes('WITHDRAWAL') || reason.includes('ABORTED'))
    ) {
      restoreVeilResidueBaseline(inc.runVeilResidueBaseline);
    }
    if (isRunFailure && runStateRef.current.runActive && runStartedAtMsRef.current != null) {
      const depth = depthFromNodesCleared(inc.nodesCleared);
      const depthLayer = getDistrictFromDepth(depth);
      const deathResources = resolveRunDeathResourceState(
        inc.cargo,
        inc.runBankedSnapshot,
        inc.runResourceLedger,
      );
      if (Object.keys(deathResources.bankedResources).length > 0
        || Object.keys(inc.runBankedSnapshot.consumables).length > 0) {
        persistRunBankedSnapshot(inc.runBankedSnapshot);
      }
      setDeathSummary({
        timeAliveMs: Date.now() - runStartedAtMsRef.current,
        causeOfDeath: lastKillingEnemyRef.current ?? reason,
        sectorLevel: localLevelFromDepth(depth),
        depthLayer,
        lostResources: deathResources.lostResources,
        bankedResourcesSurvived: deathResources.bankedResources,
        resourceLedger: deathResources.ledger,
        contractResult: resolveContractResult({
          contract: inc.activeContract,
          ledger: deathResources.ledger,
          progress: inc.contractRunProgress,
          extractedSuccessfully: false,
        }),
      });
    }
    combatLogActiveRef.current = false;
    setRunLog([]);
    const reset = createInitialRunState();
    runStateRef.current = reset;
    setRunState(reset);
    setPostCombatMutationChoices([]);
    const resetIncursion = createDefaultActiveIncursionState();
    activeIncursionRef.current = resetIncursion;
    setActiveIncursion(resetIncursion);
    narrativeNodeRef.current = null;
    narrativeAssemblyRef.current = null;
  }, [persistRunBankedSnapshot, restoreVeilResidueBaseline]);

  const getRunElapsedMs = useCallback(() => {
    if (!runStateRef.current.runActive || runStartedAtMsRef.current == null) return null;
    return Date.now() - runStartedAtMsRef.current;
  }, []);

  const getLastKillingEnemyDesignation = useCallback(
    () => lastKillingEnemyRef.current,
    [],
  );

  const registerOperationContributionApplier = useCallback(
    (applier: ((operationId: string, amount: number) => Promise<void>) | null) => {
      operationContributionApplierRef.current = applier;
    },
    [],
  );

  const finishDevSandbox = useCallback(() => {
    const reset = createInitialRunState();
    runStateRef.current = reset;
    setRunState(reset);
    setPostCombatMutationChoices([]);
    const resetIncursion = createDefaultActiveIncursionState();
    activeIncursionRef.current = resetIncursion;
    setActiveIncursion(resetIncursion);
    narrativeNodeRef.current = null;
    narrativeAssemblyRef.current = null;
    combatLogActiveRef.current = false;
    appendRunLog('>> DEV SANDBOX CONCLUDED — RETURNING TO TEST HUB.');
  }, [appendRunLog]);

  const finishBadgeTestCombat = finishDevSandbox;

  const applyDevSandboxBaseRun = useCallback((
    preset: DevSandboxPreset,
    config: BadgeTestCombatConfig,
  ) => {
    const combatPreset = preset === 'combat-easy'
      ? 'easy' as const
      : preset === 'combat-hard'
        ? 'hard' as const
        : null;
    const next: RunState = {
      ...createInitialRunState(),
      runActive: true,
      maxSoulAnchor: BASE_MAX_SOUL_ANCHOR,
      soulAnchorIntegrity: BASE_MAX_SOUL_ANCHOR,
      maxStamina: BASE_MAX_STAMINA,
      currentStamina: BASE_MAX_STAMINA,
      currentSector: INITIAL_SECTOR_POOL[0],
      combatTestPreset: combatPreset,
      devSandboxPreset: preset,
    };
    runStateRef.current = next;
    setRunState(next);
    const resetIncursion: ActiveIncursionState = {
      ...createDefaultActiveIncursionState(),
      isRunActive: true,
      activeClass: config.activeClass,
      aegisLoadout: [...config.aegisLoadout] as AegisLoadout,
      hexShotLoadout: sanitizeHexShotCombatLoadout(config.hexShotLoadout),
      envoyLoadout: sanitizeEnvoyCombatLoadout(config.envoyLoadout),
      alignedFaction: config.alignedFaction ?? null,
      runCredits: 750,
      nodesCleared: 4,
      currentDistrict: 2 as const,
      mapMode: 'NODE_ENGAGED',
    };
    activeIncursionRef.current = resetIncursion;
    setActiveIncursion(resetIncursion);
    narrativeNodeRef.current = null;
    narrativeAssemblyRef.current = null;
    setPostCombatMutationChoices([]);
    combatLogActiveRef.current = true;
    setRunLog([`>> DEV SANDBOX — ${preset.replace(/-/g, ' ').toUpperCase()}.`]);
  }, []);

  const exitCombatToBadge = useCallback(() => {
    if (runStateRef.current.devSandboxPreset || runStateRef.current.combatTestPreset) {
      finishDevSandbox();
      return;
    }
    endRun('OPERATIVE WITHDRAWAL — RUN ABORTED');
  }, [endRun, finishDevSandbox]);

  const setIncursionMapMode = useCallback((mode: IncursionMapMode) => {
    setActiveIncursion((prev) => {
      if (prev.mapMode === mode) return prev;
      const next = { ...prev, mapMode: mode };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const purgeEncounterState = useCallback(() => {
    narrativeNodeRef.current = null;
    narrativeAssemblyRef.current = null;
    setActiveIncursion((prev) => {
      const next: ActiveIncursionState = {
        ...prev,
        currentNarrativeId: null,
        activeChoice: null,
        bossProfile: null,
        mapMode: 'SCANNING_HUB',
        lastCheckpointMessage: null,
      };
      activeIncursionRef.current = next;
      return next;
    });
    setRunState((prev) => {
      const next = {
        ...prev,
        pendingEncounter: null,
        pendingEnemy: null,
        pendingEnemies: [],
      };
      runStateRef.current = next;
      return next;
    });
  }, []);

  const enrichNarrativeNode = useCallback((node: NarrativeEventNode): NarrativeEventNode => {
    const inc = activeIncursionRef.current;
    const matrixId = node.matrixEventId ?? node.id;
    if (matrixId !== 'sector-07') return node;
    const hasGrapple = hasCargoItem(inc.cargo, 'gravity-grapple');
    return {
      ...node,
      choiceB: {
        ...node.choiceB,
        locked: !hasGrapple,
        lockReason: hasGrapple ? undefined : 'CARGO: GRAVITY GRAPPLE REQUIRED',
      },
    };
  }, []);

  const assignNarrativeForCombat = useCallback((encounterNode?: IncursionNode | null) => {
    const inc = activeIncursionRef.current;
    const vectorNode = encounterNode ?? resolveActiveVectorNode(inc);
    const eligibility = {
      alignedFaction: inc.alignedFaction,
      cargo: inc.cargo,
      activeClass: inc.activeClass ?? 'AEGIS',
    };
    const picked = pickSectorNarrativeForNode(
      vectorNode,
      inc.progress,
      inc.nodesCleared,
      eligibility,
      inc.currentMacroBiomeFamily ?? 'CITY_STREETS',
    );
    const node = enrichNarrativeNode(
      enrichProceduralNarrativeNode(picked.node, picked.assembly, eligibility),
    );
    narrativeNodeRef.current = node;
    narrativeAssemblyRef.current = picked.assembly;
    const primed = primeNarrativeEnvironment(node);
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        currentNarrativeId: node.matrixEventId ?? node.id,
        lastCheckStatus: 'NOT_TESTED' as CheckStatus,
        activeChoice: null,
        mapMode: 'NODE_ENGAGED' as IncursionMapMode,
        environmentalModifiers: {
          ...prev.environmentalModifiers,
          ...primed,
        },
      };
      activeIncursionRef.current = next;
      return next;
    });
    if (inc.currentMacroBiomeFamily) {
      appendRunLog(`>> ${getMacroBiomeContextLog(inc.currentMacroBiomeFamily)}`);
    }
    appendRunLog(`>> NARRATIVE VECTOR LOCKED — ${node.title}.`);
    if (node.interactionMode === 'procedural') {
      appendRunLog('>> PROCEDURAL ASSEMBLY COMPLETE — SELECT EXPEDITION RESOLVER.');
    } else {
      appendRunLog('>> ENCOUNTER LAYER MOUNTED — FIELD CALIBRATION REQUIRED.');
    }
  }, [appendRunLog, enrichNarrativeNode]);

  const getCurrentNarrativeNode = useCallback((): NarrativeEventNode | null => {
    return narrativeNodeRef.current;
  }, []);

  const abortNarrativeEncounter = useCallback(() => {
    narrativeNodeRef.current = null;
    narrativeAssemblyRef.current = null;
    narrativeAssemblyRef.current = null;
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        currentNarrativeId: null,
        activeChoice: null,
        mapMode: 'SCANNING_HUB' as IncursionMapMode,
      };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog('>> NARRATIVE ABORT — RETURNING TO LEY-LINE GRID.');
  }, [appendRunLog]);

  const resolveNarrativeChoice = useCallback((
    choice: import('../types/game').NarrativeChoiceKey,
    status: CheckStatus = 'SUCCESS',
    options?: { tensionBonusCredits?: number },
  ): { outcomeText: string; aborted: boolean; creditReward: number; requiresResourcePack: boolean; triggerCombatAmbush: boolean } => {
    const node = narrativeNodeRef.current;
    if (!node) {
      return {
        outcomeText: '>> NARRATIVE RESOLVED — NO ACTIVE NODE.',
        aborted: false,
        creditReward: 0,
        requiresResourcePack: false,
        triggerCombatAmbush: false,
      };
    }

    const inc = activeIncursionRef.current;
    const prevRun = runStateRef.current;
    const snapshot = {
      maxSoulAnchor: prevRun.maxSoulAnchor,
      soulAnchorIntegrity: prevRun.soulAnchorIntegrity,
      maxStamina: prevRun.maxStamina,
      currentStamina: prevRun.currentStamina,
      startingAbyssalReservePercent: prevRun.startingAbyssalReservePercent,
    };

    const assembly = narrativeAssemblyRef.current;
    const result = node.interactionMode === 'procedural' && assembly
      ? assembly.engineVersion === 'assembly-v1' || assembly.engineVersion === 'assembly-v2'
        ? resolveAssemblyNarrativeChoice(
          assembly,
          choice,
          status,
          inc.progress,
          inc.environmentalModifiers,
          snapshot,
          {
            alignedFaction: inc.alignedFaction,
            cargo: inc.cargo,
            activeClass: inc.activeClass ?? 'AEGIS',
          },
        )
        : resolveProceduralNarrativeChoice(
          assembly,
          choice,
          inc.progress,
          inc.environmentalModifiers,
          snapshot,
          { alignedFaction: inc.alignedFaction, cargo: inc.cargo },
          inc.resonance.percent,
        )
      : resolveMatrixNarrativeChoice(
        node.matrixEventId ?? node.id,
        choice === 'C' || choice === 'D' ? 'A' : choice,
        rollVirtualD20(),
        inc.progress,
        inc.environmentalModifiers,
        snapshot,
        inc.currentEncounterIndex,
        { forceSuccess: status === 'SUCCESS', forceFailure: status === 'FAILURE' },
        inc.cargo,
      );

    if (result.abortToScanner) {
      result.logLines.forEach((line) => appendRunLog(line));
      abortNarrativeEncounter();
      return { outcomeText: result.outcomeText, aborted: true, creditReward: 0, requiresResourcePack: false, triggerCombatAmbush: false };
    }

    const resourceCacheId = result.resourceCacheId;
    let requiresResourcePack = false;
    const tensionBonus = options?.tensionBonusCredits ?? 0;
    const creditReward = (result.pendingRunCredits ?? 0) + tensionBonus;
    const triggerCombatAmbush = AMBUSH_ENCOUNTERS_ENABLED && result.triggerCombatAmbush;
    setActiveIncursion((prev) => {
      const beforeCargo = prev.cargo;
      let nextCargo = result.cargoPatch ?? prev.cargo;
      const stagedIds: string[] = [];
      if (resourceCacheId) {
        nextCargo = applyResourceBundleToCargo(nextCargo, getResourceCacheBundle(resourceCacheId), stagedIds);
        requiresResourcePack = true;
      }
      if (result.bonusReward?.kind === 'VEIL_RESIDUE') {
        nextCargo = applyVeilResidueBonus(nextCargo, result.bonusReward.amount, stagedIds);
      }

      let nextPendingBoons = prev.pendingNarrativeCombatBoons;
      let nextStatusEffects = prev.runStatusEffects;
      if (result.bonusReward?.kind === 'BOON') {
        nextPendingBoons = applyBoonToPending(nextPendingBoons, result.bonusReward.boonId);
        const boonEffect = runStatusEffectForBoon(result.bonusReward.boonId);
        nextStatusEffects = nextStatusEffects.some((e) => e.id === boonEffect.id)
          ? nextStatusEffects
          : [...nextStatusEffects, boonEffect];
      }

      let next: ActiveIncursionState = {
        ...prev,
        progress: result.progress,
        environmentalModifiers: result.environmentalModifiers,
        lastCheckStatus: result.status,
        activeChoice: choice,
        cargo: nextCargo,
        harvestStagingInstanceIds: stagedIds.length > 0
          ? [...new Set([...prev.harvestStagingInstanceIds, ...stagedIds])]
          : prev.harvestStagingInstanceIds,
        pendingHarvestReturn: requiresResourcePack ? 'RESOURCE_CACHE' : prev.pendingHarvestReturn,
        pendingNarrativeCombatBoons: nextPendingBoons,
        runStatusEffects: nextStatusEffects,
        runResourceLedger: recordNewResourcesFromCargoDelta(prev.runResourceLedger, beforeCargo, nextCargo),
      };
      if (result.spawnGridHound) {
        next = activateGridHoundOnIncursion(next);
      }
      activeIncursionRef.current = next;
      return next;
    });

    setRunState((prev) => {
      const next = {
        ...prev,
        ...result.runPatch,
        pendingAmbush: triggerCombatAmbush ? true : prev.pendingAmbush,
      };
      runStateRef.current = next;
      return next;
    });

    narrativeNodeRef.current = null;
    narrativeAssemblyRef.current = null;
    narrativeAssemblyRef.current = null;

    result.logLines.forEach((line) => appendRunLog(line));
    return {
      outcomeText: result.outcomeText,
      aborted: false,
      creditReward,
      requiresResourcePack,
      triggerCombatAmbush,
    };
  }, [abortNarrativeEncounter, appendRunLog]);

  const getCurrentEncounterNode = useCallback(() => {
    const inc = activeIncursionRef.current;
    return inc.encounterPath[inc.currentEncounterIndex] ?? null;
  }, []);

  const ensureScannerGraphExpanded = useCallback(() => {
    const inc = activeIncursionRef.current;
    const expandedInc = persistExpandedSectorGraph(inc);
    if (expandedInc === inc) return;
    activeIncursionRef.current = expandedInc;
    setActiveIncursion(expandedInc);
  }, []);

  const getCurrentVectorCluster = useCallback(() => buildSectorCluster(activeIncursionRef.current), []);

  const syncProceduralScannerTypes = useCallback(() => {
    setActiveIncursion((prev) => {
      if (!isProceduralRunActive(prev)) return prev;
      const prepared = prepareProceduralScannerIncursion(prev);
      if (prepared.proceduralRunTree === prev.proceduralRunTree) return prev;
      const next = {
        ...prepared,
        unstableCargoEffectsSeen: mergeUnstableCargoEffectsSeen(
          prev.unstableCargoEffectsSeen,
          prev.cargo,
        ),
      };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const getSelectedVectorNode = useCallback(() => {
    const inc = activeIncursionRef.current;
    if (!inc.selectedVectorId) return inc.encounterPath[inc.nodesCleared] ?? null;
    const cluster = buildSectorCluster(inc);
    return findVectorInCluster(cluster, inc.selectedVectorId) ?? inc.encounterPath[inc.nodesCleared] ?? null;
  }, []);

  const openScanPreview = useCallback((nodeId: string) => {
    const inc = activeIncursionRef.current;
    if (inc.mapMode !== 'SCANNING_HUB') return;
    const cluster = buildSectorCluster(inc);
    if (!findVectorInCluster(cluster, nodeId)) return;
    setActiveIncursion((prev) => {
      const next = { ...prev, previewNodeId: nodeId, scanConfirmOverlayVisible: false };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const closeScanPreview = useCallback(() => {
    setActiveIncursion((prev) => {
      const next = { ...prev, previewNodeId: null, scanConfirmOverlayVisible: false };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const getPreviewNode = useCallback((): IncursionNode | null => {
    const inc = activeIncursionRef.current;
    if (!inc.previewNodeId) return null;
    const cluster = buildSectorCluster(inc);
    const node = findVectorInCluster(cluster, inc.previewNodeId);
    if (!node) return null;
    const isFocused = inc.focusedNodeIds.includes(node.id) || node.sectorMeta?.isFocused === true;
    if (!isFocused || !node.sectorMeta) return node;
    return {
      ...node,
      sectorMeta: { ...node.sectorMeta, isFocused: true },
    };
  }, []);

  const spendAttunementCharge = useCallback((): boolean => {
    const inc = activeIncursionRef.current;
    if (inc.attunement.current <= 0) {
      appendRunLog('[REJECTED] >> Insufficient attunement charge.');
      return false;
    }
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        attunement: { ...prev.attunement, current: prev.attunement.current - 1 },
      };
      activeIncursionRef.current = next;
      return next;
    });
    return true;
  }, [appendRunLog]);

  const focusPreviewNode = useCallback((): boolean => {
    const inc = activeIncursionRef.current;
    if (isFullBlindZone(inc.nodesCleared)) {
      appendRunLog('[REJECTED] >> INNER SANCTUM — attunement reveal offline.');
      return false;
    }
    const cluster = buildSectorCluster(inc);
    const preview = inc.previewNodeId
      ? findVectorInCluster(cluster, inc.previewNodeId)
      : null;
    if (preview?.type === 'SAFE_ANCHOR_EXTRACTION' || preview?.type === 'MASTER_EXTRACTION_LINK') {
      appendRunLog('>> EXTRACTION CONDUIT — intel pre-authenticated. No attunement required.');
      return true;
    }
    if (!inc.previewNodeId || inc.attunement.current <= 0) {
      appendRunLog('[REJECTED] >> Insufficient attunement for Focus Perception.');
      return false;
    }
    if (inc.focusedNodeIds.includes(inc.previewNodeId)) {
      appendRunLog('>> Vector already focused — spectral intel unlocked.');
      return true;
    }
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        attunement: { ...prev.attunement, current: prev.attunement.current - 1 },
        focusedNodeIds: [...prev.focusedNodeIds, prev.previewNodeId!],
      };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog('>> FOCUS PERCEPTION — attunement spent. Spectral intel unlocked.');
    return true;
  }, [appendRunLog]);

  const calculateSectorExtractionPayout = useCallback((): number => {
    const inc = activeIncursionRef.current;
    const pathBonus = inc.encounterPath.reduce((sum, node) => sum + (node.sectorMeta?.creditBonus ?? 0), 0);
    let total = inc.runCredits + pathBonus + 150;
    if (inc.primeExtractionBonus) total = Math.floor(total * 1.5);
    if (inc.masterLinkUsed) {
      total = Math.floor(total * MASTER_EXTRACTION_PAYOUT_MULTIPLIER);
    }
    if (getGreedZoneActive(inc.nodesCleared)) total = Math.floor(total * 1.25);
    return total;
  }, []);

  const relocateCargoItem = useCallback((instanceId: string, row: number, col: number) => {
    let placed = false;
    let wasInContainment = false;
    let wasInGrid = false;
    let nextCargo: ReturnType<typeof relocateCargoItemState> = null;

    setActiveIncursion((prev) => {
      wasInContainment = prev.cargo.containment.some((item) => item.instanceId === instanceId);
      wasInGrid = prev.cargo.grid.placed.some((item) => item.instanceId === instanceId);
      nextCargo = relocateCargoItemState(prev.cargo, instanceId, row, col);
      if (!nextCargo) return prev;
      placed = true;
      const next = { ...prev, cargo: nextCargo };
      activeIncursionRef.current = next;
      return next;
    });

    if (!placed || !nextCargo) return false;

    const occupancy = Math.round(calculateGridOccupancy(nextCargo) * 100);
    if (wasInContainment) {
      appendRunLog(`>> CARGO PACKED — grid occupancy ${occupancy}%.`);
    } else if (wasInGrid) {
      appendRunLog(`>> CARGO REPACKED — grid occupancy ${occupancy}%.`);
    }
    return true;
  }, [appendRunLog]);

  const discardCargoInstance = useCallback((instanceId: string) => {
    let removed = false;
    let itemName = 'Unknown item';

    setActiveIncursion((prev) => {
      const containmentItem = prev.cargo.containment.find((item) => item.instanceId === instanceId);
      const placedItem = prev.cargo.grid.placed.find((item) => item.instanceId === instanceId);
      const target = containmentItem ?? placedItem;
      if (!target) return prev;

      itemName = CARGO_ITEM_CATALOG[target.itemId].name;
      removed = true;
      const nextCargo = containmentItem
        ? {
            ...prev.cargo,
            containment: prev.cargo.containment.filter((item) => item.instanceId !== instanceId),
          }
        : removePlacedCargoItem(prev.cargo, instanceId);
      const next = {
        ...prev,
        cargo: nextCargo,
        harvestStagingInstanceIds: prev.harvestStagingInstanceIds.filter((id) => id !== instanceId),
      };
      activeIncursionRef.current = next;
      return next;
    });

    if (removed) {
      appendRunLog(`>> CARGO JETTISONED — ${itemName} discarded from inventory.`);
    }
    return removed;
  }, [appendRunLog]);

  const placeCargoItem = relocateCargoItem;

  const applyHarvestChoice = useCallback((tier: HarvestYieldTier): { logLines: string[]; ambushTriggered: boolean } => {
    const inc = activeIncursionRef.current;
    const node = resolveActiveVectorNode(inc);
    const option = HARVEST_YIELD_OPTIONS.find((entry) => entry.tier === tier)!;
    const isElite = node?.type === 'ELITE_COMBAT' || node?.sectorMeta?.combatTier === 'ELITE';
    const proceduralPool = inc.pendingProceduralResourcePool;
    const lootIds = proceduralPool.length > 0
      ? [...proceduralPool] as import('../types/cargoGrid').CargoItemId[]
      : buildHarvestLoot(tier, inc.sectorTier, isElite, inc.nodesCleared);

    let nextCargo = inc.cargo;
    const stagedIds: string[] = [];
    lootIds.forEach((itemId) => {
      const count = scaledLootCount(option.yieldPct, itemId === 'veil-residue-bulk' ? 1 : 1);
      nextCargo = addLootToContainment(nextCargo, itemId, count, stagedIds);
    });
    const ambushTriggered = AMBUSH_ENCOUNTERS_ENABLED && Math.random() * 100 < option.ambushRiskPct;
    const logLines = [
      proceduralPool.length > 0
        ? `>> RESOURCE NODE YIELD — ${proceduralPool.length} salvage bundle(s) routed to containment.`
        : `>> ${option.label} — ${option.yieldPct}% yield routed to containment.`,
    ];
    if (ambushTriggered) logLines.push('>> DEEP EXTRACT HEAT — hostile ambush frequency detected.');

    setActiveIncursion((prev) => {
      const beforeCargo = prev.cargo;
      const next = {
        ...prev,
        cargo: nextCargo,
        harvestStagingInstanceIds: [...new Set([...prev.harvestStagingInstanceIds, ...stagedIds])],
        pendingProceduralResourcePool: [],
        runResourceLedger: recordNewResourcesFromCargoDelta(prev.runResourceLedger, beforeCargo, nextCargo),
      };
      activeIncursionRef.current = next;
      return next;
    });

    if (ambushTriggered) {
      setRunState((prev) => {
        const next = { ...prev, pendingAmbush: true };
        runStateRef.current = next;
        return next;
      });
    }

    return { logLines, ambushTriggered };
  }, []);

  const useFocusingAmpouleFromCargo = useCallback((): boolean => {
    const inc = activeIncursionRef.current;
    if (inc.attunement.current >= inc.attunement.max) {
      appendRunLog('[REJECTED] >> Attunement already at maximum.');
      return false;
    }
    const ampoule = inc.cargo.grid.placed.find((item) => item.itemId === 'focusing-ampoule');
    if (!ampoule) {
      appendRunLog('[REJECTED] >> No Focusing Ampoule packed in cargo grid.');
      return false;
    }

    const nextPlaced = inc.cargo.grid.placed.filter((item) => item.instanceId !== ampoule.instanceId);
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        attunement: {
          ...prev.attunement,
          current: Math.min(prev.attunement.max, prev.attunement.current + 1),
        },
        cargo: {
          ...prev.cargo,
          grid: { placed: nextPlaced },
        },
      };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog('>> FOCUSING AMPOULE DEPLOYED — +1 attunement restored.');
    return true;
  }, [appendRunLog]);

  const hasSonarPingInCargo = useCallback((): boolean => {
    const inc = activeIncursionRef.current;
    return inc.cargo.grid.placed.some((item) => item.itemId === 'sonar-ping');
  }, []);

  const useSonarPingOnNode = useCallback((nodeId: string): boolean => {
    const inc = activeIncursionRef.current;
    if (!inc.proceduralRunTree) {
      appendRunLog('[REJECTED] >> No procedural run tree active.');
      return false;
    }
    if (inc.revealedSonarNodeIds.includes(nodeId)) {
      appendRunLog('[REJECTED] >> Sonar trace already mapped for this vector.');
      return false;
    }
    const treeNode = inc.proceduralRunTree.nodes[nodeId];
    if (!treeNode) {
      appendRunLog('[REJECTED] >> Invalid sonar target.');
      return false;
    }
    const availableIds = getAvailableProceduralNodeIds(inc);
    if (!availableIds.includes(nodeId)) {
      appendRunLog('[REJECTED] >> Sonar target not on current depth layer.');
      return false;
    }
    const ping = inc.cargo.grid.placed.find((item) => item.itemId === 'sonar-ping');
    if (!ping) {
      appendRunLog('[REJECTED] >> No Sonar-Ping packed in cargo grid.');
      return false;
    }

    const nextPlaced = inc.cargo.grid.placed.filter((item) => item.instanceId !== ping.instanceId);
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        revealedSonarNodeIds: [...prev.revealedSonarNodeIds, nodeId],
        cargo: {
          ...prev.cargo,
          grid: { placed: nextPlaced },
        },
      };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog('>> SONAR-PING DEPLOYED — downstream vector types illuminated.');
    return true;
  }, [appendRunLog]);

  const beginPostCombatHarvest = useCallback((initialStagingIds: readonly string[] = []) => {
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        pendingHarvestReturn: 'POST_COMBAT' as const,
        mapMode: 'NODE_ENGAGED' as IncursionMapMode,
        harvestStagingInstanceIds: [...new Set(initialStagingIds)],
      };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const beginResourceNodeHarvest = useCallback((resourcePool?: readonly string[]) => {
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        pendingHarvestReturn: 'COMPLETE_NODE' as const,
        mapMode: 'NODE_ENGAGED' as IncursionMapMode,
        harvestStagingInstanceIds: [],
        ...(resourcePool?.length ? { pendingProceduralResourcePool: resourcePool } : {}),
      };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const beginResourceCachePack = useCallback(() => {
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        pendingHarvestReturn: 'RESOURCE_CACHE' as const,
        mapMode: 'NODE_ENGAGED' as IncursionMapMode,
        harvestStagingInstanceIds: [],
      };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const grantCombatResourceDrops = useCallback((options: CombatRewardContext): readonly string[] => {
    const inc = activeIncursionRef.current;
    const rareLootBonusPct = resolveEffectiveRareLootBonusPct(
      options.rareLootBonusPct ?? inc.runModifiers?.rareLootBonusPct ?? 0,
      inc.cargo,
    );
    const occultRewardBonusPct = resolveEffectiveOccultRewardBonusPct(inc.cargo);
    const drops = rollCombatResourceDrops({
      ...options,
      rareLootBonusPct,
      occultRewardBonusPct,
    });
    if (drops.length === 0) return [];
    const stagedIds: string[] = [];
    let pickupLogs: string[] = [];
    setActiveIncursion((prev) => {
      const beforeCargo = prev.cargo;
      let nextCargo = beforeCargo;
      drops.forEach((resourceId) => {
        nextCargo = addLootToContainment(nextCargo, resourceId, 1, stagedIds);
      });
      const newPickups = detectNewUnstableCargoPickups(
        beforeCargo,
        nextCargo,
        prev.unstableCargoPickupLogged,
      );
      pickupLogs = newPickups.map((id) => formatUnstableCargoPickupLog(id));
      const next = {
        ...prev,
        cargo: nextCargo,
        unstableCargoPickupLogged: mergeUnstableCargoPickupLog(
          beforeCargo,
          nextCargo,
          prev.unstableCargoPickupLogged,
        ),
        unstableCargoEffectsSeen: mergeUnstableCargoEffectsSeen(
          prev.unstableCargoEffectsSeen,
          nextCargo,
        ),
        runResourceLedger: recordNewResourcesFromCargoDelta(prev.runResourceLedger, beforeCargo, nextCargo),
      };
      activeIncursionRef.current = next;
      return next;
    });
    pickupLogs.forEach((line) => appendRunLog(line));
    appendRunLog(formatCombatResourceDropLog(drops));
    return stagedIds;
  }, [appendRunLog]);

  const grantCombatSalvage = useCallback((
    resourceId: import('../types/resourceItem').ResourceItemId,
    quantity: number,
  ) => {
    if (quantity <= 0) return;
    const stagedIds: string[] = [];
    let pickupLogs: string[] = [];
    setActiveIncursion((prev) => {
      const beforeCargo = prev.cargo;
      let nextCargo = beforeCargo;
      for (let i = 0; i < quantity; i += 1) {
        nextCargo = addLootToContainment(nextCargo, resourceId, 1, stagedIds);
      }
      const newPickups = detectNewUnstableCargoPickups(
        beforeCargo,
        nextCargo,
        prev.unstableCargoPickupLogged,
      );
      pickupLogs = newPickups.map((id) => formatUnstableCargoPickupLog(id));
      const next = {
        ...prev,
        cargo: nextCargo,
        unstableCargoPickupLogged: mergeUnstableCargoPickupLog(
          beforeCargo,
          nextCargo,
          prev.unstableCargoPickupLogged,
        ),
        unstableCargoEffectsSeen: mergeUnstableCargoEffectsSeen(
          prev.unstableCargoEffectsSeen,
          nextCargo,
        ),
        runResourceLedger: recordNewResourcesFromCargoDelta(prev.runResourceLedger, beforeCargo, nextCargo),
      };
      activeIncursionRef.current = next;
      return next;
    });
    pickupLogs.forEach((line) => appendRunLog(line));
    appendRunLog(`>> COMBAT SALVAGE — ${quantity}× ${resourceId.toUpperCase()} routed to cargo.`);
  }, [appendRunLog]);

  const applyVoidsTollSacrifice = useCallback(() => {
    setRunState((prev) => {
      const nextMaxHp = Math.max(1, Math.floor(prev.maxSoulAnchor * 0.85));
      const next = {
        ...prev,
        maxSoulAnchor: nextMaxHp,
        soulAnchorIntegrity: Math.min(prev.soulAnchorIntegrity, nextMaxHp),
      };
      runStateRef.current = next;
      return next;
    });
    setActiveIncursion((prev) => {
      const next = { ...prev, voidsTollApBonus: prev.voidsTollApBonus + 1 };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog(">> [VOID'S TOLL] — +1 max AP this incursion. Max soul anchor −15%.");
  }, [appendRunLog]);

  const finalizeHarvestScreen = useCallback(() => {
    const inc = activeIncursionRef.current;
    const stagingIds = new Set(inc.harvestStagingInstanceIds);
    const hadLooseResidue = inc.cargo.containment.some((item) => isVeilResidueCargoItem(item.itemId));
    const hadUnpackedStaging = inc.cargo.containment.some((item) => stagingIds.has(item.instanceId));
    const hadResidueOnGrid = inc.cargo.grid.placed.some((item) => isVeilResidueCargoItem(item.itemId));
    const nextCargo = finalizeHarvestCargoState(inc.cargo, stagingIds);

    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        cargo: nextCargo,
        harvestStagingInstanceIds: [],
      };
      activeIncursionRef.current = next;
      return next;
    });

    if (hadLooseResidue || hadUnpackedStaging || hadResidueOnGrid) {
      appendRunLog('>> UNCLAIMED HARVEST LOOT PURGED — unstaged resources dissipated.');
    }
  }, [appendRunLog]);

  const applyVeilBleedHpCost = useCallback(() => {
    setRunState((prev) => {
      const maxSoulAnchor = Math.max(
        1,
        Math.floor(prev.maxSoulAnchor * (1 - VEIL_BLEED_HP_COST_PCT / 100)),
      );
      const soulAnchorIntegrity = Math.min(prev.soulAnchorIntegrity, maxSoulAnchor);
      const next = { ...prev, maxSoulAnchor, soulAnchorIntegrity };
      runStateRef.current = next;
      return next;
    });
    appendRunLog(`>> VEIL BLEED — Ley-Scar cost applied (−${VEIL_BLEED_HP_COST_PCT}% max HP).`);
  }, [appendRunLog]);

  const absorbVeilResidueParticle = useCallback((
    instanceId: string,
    value: number,
    finalizeInstance: boolean,
  ): number => {
    let applied = 0;

    setActiveIncursion((prev) => {
      if (prev.sessionVeilResidueCollected >= MAX_RUN_CANISTER_RESIDUE) return prev;

      const target = prev.cargo.containment.find((item) => item.instanceId === instanceId);
      if (!target || target.itemId !== 'veil-residue-bulk') return prev;

      const headroom = MAX_RUN_CANISTER_RESIDUE - prev.sessionVeilResidueCollected;
      const clampedValue = Math.min(Math.max(value, 0), headroom);
      if (clampedValue <= 0) return prev;

      applied = clampedValue;
      const next = {
        ...prev,
        sessionVeilResidueCollected: Math.min(
          MAX_RUN_CANISTER_RESIDUE,
          prev.sessionVeilResidueCollected + clampedValue,
        ),
        cargo: finalizeInstance
          ? {
            ...prev.cargo,
            containment: prev.cargo.containment.filter((item) => item.instanceId !== instanceId),
          }
          : prev.cargo,
        harvestStagingInstanceIds: finalizeInstance
          ? prev.harvestStagingInstanceIds.filter((id) => id !== instanceId)
          : prev.harvestStagingInstanceIds,
      };
      activeIncursionRef.current = next;
      return next;
    });

    return applied;
  }, []);

  const prepareBossEncounter = useCallback((engagedNode?: IncursionNode | null) => {
    beginCombatRunLogSession();
    const inc = activeIncursionRef.current;
    const encounterNode = engagedNode ?? resolveActiveVectorNode(inc);
    if (!encounterNode || encounterNode.type !== 'BOSS_COMBAT') return;

    const gateDepth = depthFromNodesCleared(inc.nodesCleared);
    const anchorCtx = resolveAnchorAssaultContext(encounterNode, inc.runGenerationContext);
    let bossProfile = createBossProfileForDepth(gateDepth);
    if (anchorCtx?.isCoreEncounter) {
      bossProfile = applyAnchorCoreBossProfile(bossProfile, anchorCtx);
    }
    const sector = runStateRef.current.currentSector ?? INITIAL_SECTOR_POOL[0];
    let pendingEnemies = spawnDistrictBossSquad(
      bossProfile,
      sector,
      inc.nodesCleared,
      gateDepth,
    );
    if (anchorCtx?.isCoreEncounter) {
      pendingEnemies = applyAnchorAssaultSpawnScaling(pendingEnemies, anchorCtx);
    }
    const pendingEnemy = pendingEnemies[0] ?? null;
    let envModifiers = buildEnvironmentalModifiersForNode(inc.resonance.percent);
    if (anchorCtx) {
      envModifiers = applyAnchorRealityToEnvironment(
        envModifiers,
        anchorCtx.anchor,
        anchorCtx.stage,
      );
    }

    setActiveIncursion((prev) => {
      const next = { ...prev, bossProfile, environmentalModifiers: envModifiers };
      activeIncursionRef.current = next;
      return next;
    });

    setRunState((prev) => {
      const next = {
        ...prev,
        pendingEnemy,
        pendingEnemies,
        pendingEncounter: buildEncounter(
          inc.currentEncounterIndex,
          sector,
          'COMBAT',
          encounterNode.label,
        ),
      };
      runStateRef.current = next;
      return next;
    });

    if (inc.currentMacroBiomeFamily) {
      appendRunLog(`>> ${getMacroBiomeContextLog(inc.currentMacroBiomeFamily)}`);
    }
    if (anchorCtx) {
      anchorAssaultEngageLogLines(anchorCtx).forEach((line) => appendRunLog(line));
    } else {
      appendRunLog('>> AFFINITY CORPOREAL — prime anomaly dense tissue detected.');
      appendRunLog(districtBossLogLine(gateDepth));
    }
    appendRunLog(`>> BOSS SIGNATURE: ${bossProfile.name} // ${bossProfile.maxHp} HP`);
  }, [appendRunLog, beginCombatRunLogSession]);

  const prepareStandardCombatEncounter = useCallback((engagedNode?: IncursionNode | null) => {
    beginCombatRunLogSession();
    const inc = activeIncursionRef.current;
    const encounterNode = engagedNode ?? resolveActiveVectorNode(inc);
    const prev = runStateRef.current;
    const isResonanceAmbush = prev.pendingAmbush === true;
    if (
      !encounterNode
      || (
        !isResonanceAmbush
        && encounterNode.type !== 'STANDARD_COMBAT'
        && encounterNode.type !== 'ELITE_COMBAT'
      )
    ) return;

    const sector = prev.currentSector ?? INITIAL_SECTOR_POOL[0];
    const echoCtx = resolveEchoRecoveryContext(encounterNode, inc.runGenerationContext);
    const isEchoEncounter = echoCtx != null;
    const isElite = isResonanceAmbush || encounterNode.type === 'ELITE_COMBAT' || isEchoEncounter;
    const anchorCtx = resolveAnchorAssaultContext(encounterNode, inc.runGenerationContext);
    let envModifiers = buildEnvironmentalModifiersForNode(inc.resonance.percent);
    if (anchorCtx) {
      envModifiers = applyAnchorRealityToEnvironment(
        envModifiers,
        anchorCtx.anchor,
        anchorCtx.stage,
      );
    }
    if (echoCtx) {
      envModifiers = applyEchoResidueToEnvironment(envModifiers, echoCtx.template);
    }
    if (isElite) {
      const modifier = echoCtx?.template.eliteModifier ?? rollEliteModifier(encounterNode.id);
      envModifiers = applyEliteModifierToEnvironment(envModifiers, modifier);
      appendRunLog(`>> ELITE MODIFIER — ${ELITE_MODIFIER_LABELS[modifier]}`);
    }
    const depth = depthFromNodesCleared(inc.nodesCleared);
    const district = getDistrictFromDepth(depth);
    const spawnBudget = encounterBudgetForDepth({
      depth,
      isElite,
      isAmbush: prev.pendingAmbush,
    });
    let pendingEnemies = spawnCombatSquad({
      nodeIndex: inc.nodesCleared,
      isElite,
      isAmbush: prev.pendingAmbush,
      district,
      runSegment: inc.runSegment,
      encounterSeed: `engage:${inc.nodesCleared}:${encounterNode.id}`,
      macroBiome: inc.currentMacroBiomeFamily,
      veilBiome: inc.runVeilBiome,
      contextModifiers: encounterNode.contextModifiers,
      spawnOptions: {
        resonancePercent: inc.resonance.percent,
      },
    });
    if (anchorCtx && isElite && !echoCtx) {
      pendingEnemies = applyAnchorAssaultSpawnScaling(pendingEnemies, anchorCtx);
    }
    const pendingEnemy = pendingEnemies[0] ?? null;
    const pendingEncounter = buildEncounter(
      inc.currentEncounterIndex,
      sector,
      'COMBAT',
      encounterNode.label,
    );

    setActiveIncursion((prevState) => ({
      ...prevState,
      environmentalModifiers: envModifiers,
    }));
    activeIncursionRef.current = {
      ...activeIncursionRef.current,
      environmentalModifiers: envModifiers,
    };

    setRunState((prevState) => {
      const next = {
        ...prevState,
        currentSector: sector,
        pendingEnemy,
        pendingEnemies,
        pendingEncounter,
      };
      runStateRef.current = next;
      return next;
    });

    if (inc.currentMacroBiomeFamily) {
      appendRunLog(`>> ${getMacroBiomeContextLog(inc.currentMacroBiomeFamily)}`);
    }
    if (anchorCtx && isElite && !echoCtx) {
      anchorAssaultEngageLogLines(anchorCtx).forEach((line) => appendRunLog(line));
    }
    if (echoCtx) {
      echoRecoveryEngageLogLines(echoCtx).forEach((line) => appendRunLog(line));
    }
    appendRunLog(
      `>> HOSTILE CLUSTER — ${pendingEnemies.length} signature(s) // threat budget ${spawnBudget.spawnBudget} pts.`,
    );
    pendingEnemies.forEach((unit) => {
      appendRunLog(`>> — ${unit.designation} [${unit.class}] HP ${unit.currentHp} // ${unit.gridSlot ?? 'FL_0'}`);
      if (unit.isApex) {
        appendRunLog('>> APEX ANOMALY — full threat budget absorbed; double action economy.');
      }
    });
  }, [appendRunLog, beginCombatRunLogSession]);

  const startDevSandboxNode = useCallback((preset: DevSandboxPreset, config: BadgeTestCombatConfig) => {
    applyDevSandboxBaseRun(preset, config);

    if (preset === 'combat-easy' || preset === 'combat-hard') {
      const pendingEnemies = squadFromSingleEnemy(
        preset === 'combat-easy' ? createEasyTestEnemy() : createHardTestEnemy(),
      );
      const pendingEnemy = pendingEnemies[0] ?? null;
      setRunState((prev) => {
        const next = { ...prev, pendingEnemy, pendingEnemies };
        runStateRef.current = next;
        return next;
      });
      appendRunLog(`>> HOSTILE: ${pendingEnemy?.designation ?? 'UNKNOWN'}.`);
      return;
    }

    const inc = activeIncursionRef.current;
    const eligibility = buildDevSandboxEligibility(
      config.activeClass,
      inc.alignedFaction,
    );

    const tensionMechanic = resolveDevSandboxTensionMechanic(preset);
    if (tensionMechanic) {
      const picked = buildDevSandboxNarrativeEncounter(tensionMechanic, eligibility);
      narrativeNodeRef.current = picked.node;
      narrativeAssemblyRef.current = picked.assembly;
      setActiveIncursion((prev) => {
        const next = {
          ...prev,
          currentNarrativeId: picked.node.id,
          mapMode: 'NODE_ENGAGED' as IncursionMapMode,
        };
        activeIncursionRef.current = next;
        return next;
      });
      appendRunLog(`>> NARRATIVE PREVIEW — ${tensionMechanic.replace('Mechanic_', '').replace(/_/g, ' ')}.`);
      return;
    }

    if (preset === 'standard-combat' || preset === 'elite-combat') {
      const mockNode = buildDevSandboxCombatNode(
        preset === 'elite-combat' ? 'ELITE_COMBAT' : 'STANDARD_COMBAT',
      );
      prepareStandardCombatEncounter(mockNode);
      appendRunLog(`>> ${mockNode.label}.`);
      return;
    }

    if (preset === 'sanctuary') {
      setActiveIncursion((prev) => {
        const next = {
          ...prev,
          mapMode: 'NODE_ENGAGED' as IncursionMapMode,
          sessionVeilResidueCollected: 120,
        };
        activeIncursionRef.current = next;
        return next;
      });
      appendRunLog('>> SANCTUARY NODE — ATTUNE OR GRAFT PREVIEW.');
      return;
    }

    if (preset === 'black-market') {
      const stock = rollBlackMarketStock();
      setActiveIncursion((prev) => {
        const next = {
          ...prev,
          blackMarketStock: stock,
          mapMode: 'NODE_ENGAGED' as IncursionMapMode,
          runCredits: 1200,
        };
        activeIncursionRef.current = next;
        return next;
      });
      appendRunLog('>> BLACK MARKET STOCK ROLLED — CONTRABAND TERMINAL LIVE.');
      return;
    }

    if (preset === 'extraction') {
      setActiveIncursion((prev) => {
        const next = {
          ...prev,
          mapMode: 'NODE_ENGAGED' as IncursionMapMode,
          extractionReviewKind: 'SAFE_ANCHOR' as const,
          pendingSafeAnchorIndex: 1 as const,
          runCredits: 420,
        };
        activeIncursionRef.current = next;
        return next;
      });
      appendRunLog('>> EXTRACTION REVIEW — SAFE ANCHOR 1 PREVIEW.');
      return;
    }

    if (preset === 'incursion-safehouse') {
      setActiveIncursion((prev) => {
        const next = {
          ...prev,
          mapMode: 'SAFEHOUSE_INTERMISSION' as IncursionMapMode,
          currentDistrict: 2 as const,
          nodesCleared: 5,
          runCredits: 600,
        };
        activeIncursionRef.current = next;
        return next;
      });
      appendRunLog('>> INCURSION SAFEHOUSE — DISTRICT CHECKPOINT PREVIEW.');
      return;
    }

    if (preset === 'resource-harvest') {
      beginResourceNodeHarvest();
      appendRunLog('>> RESOURCE HARVEST — VEIL RESIDUE EXTRACTION PREVIEW.');
    }
  }, [appendRunLog, applyDevSandboxBaseRun, beginResourceNodeHarvest, prepareStandardCombatEncounter]);

  const startBadgeTestCombat = useCallback((preset: 'easy' | 'hard', config: BadgeTestCombatConfig) => {
    startDevSandboxNode(preset === 'easy' ? 'combat-easy' : 'combat-hard', config);
  }, [startDevSandboxNode]);

  const prepareDefendRiftEncounter = useCallback(() => {
    beginCombatRunLogSession();
    const inc = activeIncursionRef.current;
    const prev = runStateRef.current;
    const sector = prev.currentSector ?? INITIAL_SECTOR_POOL[0];
    const depth = depthFromNodesCleared(inc.nodesCleared);
    const district = getDistrictFromDepth(depth);
    const envModifiers = buildEnvironmentalModifiersForNode(inc.resonance.percent);
    const pendingEnemies = spawnCombatSquad({
      nodeIndex: inc.nodesCleared,
      isElite: true,
      unitCount: 1,
      district,
      runSegment: inc.runSegment,
      macroBiome: inc.currentMacroBiomeFamily,
      veilBiome: inc.runVeilBiome,
    });
    const pendingEnemy = pendingEnemies[0] ?? null;

    setActiveIncursion((prevState) => ({
      ...prevState,
      environmentalModifiers: envModifiers,
      defendRiftActive: true,
      mapMode: 'NODE_ENGAGED',
    }));
    activeIncursionRef.current = {
      ...activeIncursionRef.current,
      environmentalModifiers: envModifiers,
      defendRiftActive: true,
      mapMode: 'NODE_ENGAGED',
    };

    setRunState((prevState) => {
      const next = {
        ...prevState,
        currentSector: sector,
        pendingEnemy,
        pendingEnemies,
        pendingEncounter: buildEncounter(
          inc.currentEncounterIndex,
          sector,
          'COMBAT',
          'EMERGENCY RECALL // ELITE INTERCEPT',
        ),
      };
      runStateRef.current = next;
      return next;
    });

    appendRunLog('>> EMERGENCY RECALL — ELITE HOSTILE INTERCEPT.');
    if (pendingEnemy) {
      appendRunLog(`>> HOSTILE SIGNATURE: ${pendingEnemy.designation} [${pendingEnemy.class}] HP ${pendingEnemy.maxHp}.`);
    }
  }, [appendRunLog, beginCombatRunLogSession]);

  const prepareVeilStalkerEncounter = useCallback(() => {
    beginCombatRunLogSession();
    const inc = activeIncursionRef.current;
    const encounterNode = resolveActiveVectorNode(inc);
    const prev = runStateRef.current;
    const sector = prev.currentSector ?? INITIAL_SECTOR_POOL[0];
    const pendingEnemies = squadFromSingleEnemy(spawnVeilStalkerProfile(inc.nodesCleared));
    const pendingEnemy = pendingEnemies[0] ?? null;
    const envModifiers = buildEnvironmentalModifiersForNode(inc.resonance.percent);

    setActiveIncursion((prevState) => ({
      ...prevState,
      environmentalModifiers: envModifiers,
    }));
    activeIncursionRef.current = {
      ...activeIncursionRef.current,
      environmentalModifiers: envModifiers,
    };

    setRunState((prevState) => {
      const next = {
        ...prevState,
        currentSector: sector,
        pendingEnemy,
        pendingEnemies,
        pendingEncounter: buildEncounter(
          inc.currentEncounterIndex,
          sector,
          'COMBAT',
          'VEIL STALKER AMBUSH',
        ),
        pendingAmbush: true,
      };
      runStateRef.current = next;
      return next;
    });

    appendRunLog('>> HUNTER AMBUSH — null shade signature locked.');
    appendRunLog(`>> HOSTILE SIGNATURE: ${pendingEnemy.designation} [${pendingEnemy.class}] HP ${pendingEnemy.maxHp}.`);
  }, [appendRunLog, beginCombatRunLogSession]);

  const prepareHarvestAmbushEncounter = useCallback(() => {
    beginCombatRunLogSession();
    const inc = activeIncursionRef.current;
    const encounterNode = resolveActiveVectorNode(inc);
    const prev = runStateRef.current;
    const sector = prev.currentSector ?? INITIAL_SECTOR_POOL[0];
    const envModifiers = buildEnvironmentalModifiersForNode(inc.resonance.percent);
    const district = getDistrictFromDepth(depthFromNodesCleared(inc.nodesCleared));
    const pendingEnemies = spawnCombatSquad({
      nodeIndex: inc.nodesCleared,
      isElite: true,
      isAmbush: true,
      district,
      runSegment: inc.runSegment,
      macroBiome: inc.currentMacroBiomeFamily,
      veilBiome: inc.runVeilBiome,
      spawnOptions: { resonancePercent: inc.resonance.percent },
    });
    const pendingEnemy = pendingEnemies[0] ?? null;
    const pendingEncounter = buildEncounter(
      inc.currentEncounterIndex,
      sector,
      'COMBAT',
      encounterNode?.label ?? 'HARVEST AMBUSH',
    );

    setActiveIncursion((prevState) => ({
      ...prevState,
      environmentalModifiers: envModifiers,
    }));
    activeIncursionRef.current = {
      ...activeIncursionRef.current,
      environmentalModifiers: envModifiers,
    };

    setRunState((prevState) => {
      const next = {
        ...prevState,
        currentSector: sector,
        pendingEnemy,
        pendingEnemies,
        pendingEncounter,
      };
      runStateRef.current = next;
      return next;
    });

    appendRunLog('>> HARVEST AMBUSH — hostile manifest inbound.');
    appendRunLog(`>> HOSTILE SIGNATURE: ${pendingEnemy.designation} [${pendingEnemy.class}] HP ${pendingEnemy.maxHp}.`);
  }, [appendRunLog, beginCombatRunLogSession]);

  const advanceIncursionAfterEncounter = useCallback((message: string) => {
    appendRunLog(`>> ${message}`);

    const inc = activeIncursionRef.current;
    const offeredCluster = buildSectorCluster(inc);
    const lastLevelOfferedCombat = clusterOffersCombat(offeredCluster);
    const completedNode = inc.encounterPath[inc.nodesCleared] ?? resolveActiveVectorNode(inc);
    const completedIndex = inc.nodesCleared;
    const clearedDepth = depthFromNodesCleared(completedIndex);

    const encounterPath = inc.encounterPath.map((node, index) =>
      index === completedIndex ? { ...node, isCompleted: true } : node,
    );

    narrativeNodeRef.current = null;
    narrativeAssemblyRef.current = null;

    const graphNodes = { ...inc.sectorGraph.nodes };
    if (completedNode && graphNodes[completedNode.id]) {
      graphNodes[completedNode.id] = { ...graphNodes[completedNode.id], isCompleted: true };
    }

    const wasBoss = completedNode?.type === 'BOSS_COMBAT' || completedNode?.isAnomalyNest === true;
    const anchorCtx = resolveAnchorAssaultContext(completedNode, inc.runGenerationContext);
    const anchorVictory = anchorCtx && completedNode
      ? recordAnchorAssaultVictory(
          inc.anchorAssaultProgress ?? createDefaultAnchorAssaultProgress(),
          completedNode,
          anchorCtx,
        )
      : null;
    const echoCtx = resolveEchoRecoveryContext(completedNode, inc.runGenerationContext);
    const echoVictory = echoCtx && completedNode
      ? recordEchoRecoveryVictory(
          inc.echoRecoveryProgress ?? createDefaultEchoRecoveryProgress(),
          completedNode,
          echoCtx,
        )
      : null;
    const nextNodesCleared = completedIndex + 1;
    const nextCurrentNodeId =
      completedNode?.id && graphNodes[completedNode.id]
        ? completedNode.id
        : inc.currentNodeId;

    const nextCargo = inc.cargo;

    const resolvedNextNodeId = resolveScannerGraphNodeId(
      { ...inc.sectorGraph, nodes: graphNodes },
      nextCurrentNodeId,
    );
    const expandedInc = persistExpandedSectorGraph({
      ...inc,
      sectorGraph: { ...inc.sectorGraph, nodes: graphNodes },
      currentNodeId: resolvedNextNodeId,
    });

    const nextDepth = depthFromNodesCleared(nextNodesCleared);
    const nextDistrict = getDistrictFromDepth(nextDepth);

    const nextSectorGraph = expandedInc.sectorGraph;
    const nextPatrolState = inc.patrolState;
    const districtChanged = nextDistrict !== inc.currentDistrict;

    const nextBiome = inc.currentMacroBiomeFamily;
    const depth1Choice = inc.depth1MacroBiomeChoice ?? inc.currentMacroBiomeFamily;

    let nextRunSegment = inc.runSegment;
    const wasCombat =
      completedNode?.type === 'STANDARD_COMBAT' || completedNode?.type === 'ELITE_COMBAT';
    if (wasCombat && inc.runSegment && completedNode) {
      const echoCtx = resolveEchoRecoveryContext(completedNode, inc.runGenerationContext);
      const snapshot = resolveEngagedEncounterSnapshot({
        nodeIndex: completedIndex,
        isElite: completedNode.type === 'ELITE_COMBAT' || echoCtx != null,
        district: getDistrictFromDepth(clearedDepth),
        runSegment: inc.runSegment,
        encounterSeed: `engage:${completedIndex}:${completedNode.id}`,
        macroBiome: inc.currentMacroBiomeFamily,
        veilBiome: inc.runVeilBiome,
        contextModifiers: completedNode.contextModifiers,
      });
      nextRunSegment = applyEncounterToSegment(
        inc.runSegment,
        snapshot.encounterId,
        snapshot.encounterOrigin,
        snapshot.spawnOverride,
      );
    }
    if (wasBoss && isDistrictGateDepth(clearedDepth) && nextDistrict !== inc.currentDistrict) {
      nextRunSegment = createRunSegment(
        nextDistrict,
        `district:${nextDistrict}:${nextNodesCleared}`,
      );
      appendRunLog(`>> ALPHA DUEL INDEX — D${nextDistrict} NODE ${nextRunSegment.alphaNodeIndex}`);
    }

    const nextOverworldSession = generateOverworldFeatures(
      nextNodesCleared,
      nextDistrict,
      `clear-${nextNodesCleared}`,
      { width: SCOUT_ARENA_WIDTH, height: SCOUT_ARENA_HEIGHT },
      inc.overworldSession.gridHound?.caught ? null : inc.overworldSession.gridHound,
      districtChanged ? 0 : inc.overworldSession.rawBoonsClaimedThisDistrict,
      {
        activeClass: inc.activeClass ?? 'AEGIS',
        leyLineMutations: inc.leyLineMutations,
        hexShotBoons: inc.hexShotBoons,
        envoyBoons: inc.envoyBoons,
      },
    );

    const chalkWardRuntime = tickChalkLineWardAfterNodeClear({
      ...expandedInc,
      nodesCleared: nextNodesCleared,
    });

    let nextContractProgress = recordContractDepthReached(
      inc.contractRunProgress,
      Math.max(clearedDepth, nextDepth),
    );
    if (completedNode?.type === 'ELITE_COMBAT') {
      nextContractProgress = recordContractEliteKill(nextContractProgress);
    }
    if (wasBoss) {
      nextContractProgress = recordContractDepthBossDefeated(nextContractProgress);
    }
    const operationTargetsBefore = inc.contractRunProgress.operationTargetsCleared;
    nextContractProgress = recordContractOperationTargetCleared(nextContractProgress, completedNode);
    let transmittedContribution = 0;
    if (nextContractProgress.operationTargetsCleared > operationTargetsBefore) {
      const activeOperation = inc.runGenerationContext?.activeOperation;
      const operationId = activeOperation?.id;
      const targetAmount = activeOperation?.contributionRules.clearOperationTarget;
      if (operationId && targetAmount && operationContributionApplierRef.current) {
        void operationContributionApplierRef.current(operationId, targetAmount);
        transmittedContribution = targetAmount;
      }
    }

    const incAfterClear: ActiveIncursionState = {
      ...expandedInc,
      sectorGraph: nextSectorGraph,
      currentNodeId: resolvedNextNodeId,
      nodesCleared: nextNodesCleared,
      runSegment: nextRunSegment,
      boundRequisition: chalkWardRuntime ?? expandedInc.boundRequisition,
      currentDepth: nextDepth,
      currentDistrict: nextDistrict,
      lastMacroBiomeFamily: inc.currentMacroBiomeFamily,
      currentMacroBiomeFamily: nextBiome,
      pendingDistrictBiomeOffers: null,
      awaitingDistrictBiomeChoice: false,
      depth1MacroBiomeChoice: depth1Choice,
      runStatusEffects: inc.runStatusEffects.filter(
        (effect) => effect.expiresAtNodesCleared == null || effect.expiresAtNodesCleared > nextNodesCleared,
      ),
      overworldSession: nextOverworldSession,
      currentEncounterIndex: nextNodesCleared,
      encounterPath,
      cargo: nextCargo,
      patrolState: nextPatrolState,
      bossDefeated: wasBoss || inc.bossDefeated,
      primeExtractionBonus: wasBoss ? true : inc.primeExtractionBonus,
      contractRunProgress: nextContractProgress,
      operationContributionTransmitted: inc.operationContributionTransmitted + transmittedContribution,
      anchorAssaultProgress: anchorVictory?.progress
        ?? inc.anchorAssaultProgress
        ?? createDefaultAnchorAssaultProgress(),
      echoRecoveryProgress: echoVictory?.recorded
        ? echoVictory.progress
        : inc.echoRecoveryProgress ?? createDefaultEchoRecoveryProgress(),
      pendingHarvestReturn: null,
      currentNarrativeId: null,
      activeChoice: null,
      bossProfile: null,
      selectedVectorId: null,
      previewNodeId: null,
      scanConfirmOverlayVisible: false,
      mapMode: 'SCANNING_HUB',
      lastCheckpointMessage: null,
      lastLevelOfferedCombat,
    };

    setRunState((prev) => {
      const next = {
        ...prev,
        currentNode: nextNodesCleared,
        pendingEncounter: null,
        pendingEnemy: null,
        pendingEnemies: [],
      };
      runStateRef.current = next;
      return next;
    });

    const enteringSafehouse = wasBoss && isDistrictGateDepth(clearedDepth);

    const incWithMode: ActiveIncursionState = enteringSafehouse
      ? {
          ...incAfterClear,
          mapMode: 'SAFEHOUSE_INTERMISSION',
          runStatusEffects: incAfterClear.runStatusEffects.filter((effect) => !effect.expiresAtSafehouse),
        }
      : persistExpandedSectorGraph(incAfterClear);

    activeIncursionRef.current = incWithMode;
    setActiveIncursion(incWithMode);

    if (!enteringSafehouse) {
      setScanSessionKey((k) => k + 1);
    }

    if (wasBoss && isPrimeBossDepth(clearedDepth)) {
      appendRunLog('>> ANOMALY NEST NEUTRALIZED — MASTER EXTRACTION LINK ARMED.');
    } else if (enteringSafehouse) {
      appendRunLog('>> CABAL CHECKPOINT — SAFEHOUSE TERMINAL UNSEALED.');
      appendRunLog(`>> DISTRICT ${incWithMode.currentDistrict} SECURED — BANK RUN CARGO BEFORE DESCENT.`);
    } else if (wasBoss) {
      appendRunLog('>> DISTRICT GATE CLEARED — VECTOR STABILIZED.');
    }

    if (anchorVictory?.kind && anchorCtx) {
      appendRunLog(anchorAssaultClearLogLine(anchorCtx, anchorVictory.kind));
    }

    if (echoVictory?.recorded && echoCtx) {
      appendRunLog(echoRecoveryClearLogLine(echoCtx));
    }

    if (nextNodesCleared >= MAX_SECTOR_NODES && !inc.collapseActive) {
      appendRunLog('>> SECTOR CAP REACHED — MASTER EXTRACTION LINK OR COLLAPSE RIFT ONLY.');
    } else if (inc.collapseActive) {
      appendRunLog(`>> COLLAPSE RIFT NODE ${nextNodesCleared} — POCKET DIMENSION UNSTABLE.`);
    } else if (!enteringSafehouse) {
      if (nextBiome) {
        appendRunLog(formatMacroBiomeLogLine(nextBiome));
      }
      appendRunLog(`>> NODE ${nextNodesCleared}/${MAX_SECTOR_NODES} CLEARED — SCANNING HUB READY.`);
    }

    if (enteringSafehouse) {
      return { route: 'SAFEHOUSE' as const };
    }

    return { route: 'NEXT_NODE' as const };
  }, [appendRunLog]);

  const stageEncounterClear = advanceIncursionAfterEncounter;

  const continueFromProgressCheckpoint = useCallback(() => {
    const inc = activeIncursionRef.current;
    if (inc.mapMode === 'PROGRESS_CHECKPOINT') {
      return advanceIncursionAfterEncounter(
        inc.lastCheckpointMessage ?? 'Vector cleared — resuming descent.',
      );
    }
    return { route: 'NEXT_NODE' as const };
  }, [advanceIncursionAfterEncounter]);

  const engageVectorNode = useCallback((node: IncursionNode): import('../types/game').RunNodeType | null => {
    let inc = activeIncursionRef.current;
    let engagedNode = node;

    if (inc.proceduralRunTree?.nodes[node.id]) {
      const rollResult = ensureNodeContextModifiersAtEngagement(
        inc.proceduralRunTree,
        node.id,
        inc.runGenerationContext,
        inc.cargo,
      );
      if (rollResult.freshlyRolled && rollResult.node) {
        inc = {
          ...inc,
          proceduralRunTree: rollResult.tree,
        };
        activeIncursionRef.current = inc;
        engagedNode = proceduralNodeToIncursionNode(
          rollResult.node,
          inc.nodesCleared,
          inc.runVeilBiome,
        );
        if (rollResult.cargoPressureLog) {
          appendRunLog(rollResult.cargoPressureLog);
        }
      }
    }

    let enteringCollapse = inc.collapseActive;
    if (
      !inc.collapseActive
      && inc.bossDefeated
      && engagedNode.type !== 'MASTER_EXTRACTION_LINK'
      && (isCollapseForwardNode(engagedNode) || inc.nodesCleared >= MAX_SECTOR_NODES)
    ) {
      enteringCollapse = true;
      appendRunLog('>> POCKET DIMENSION COLLAPSE — sector geometry destabilizing.');
    }

    const encounterPath = [...inc.encounterPath];
    encounterPath[inc.nodesCleared] = {
      ...engagedNode,
      index: inc.nodesCleared,
      encounterIndex: inc.nodesCleared,
    };

    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        encounterPath,
        selectedVectorId: engagedNode.id,
        proceduralRunTree: inc.proceduralRunTree,
        collapseActive: enteringCollapse || prev.collapseActive,
        unstableCargoEffectsSeen: mergeUnstableCargoEffectsSeen(
          prev.unstableCargoEffectsSeen,
          prev.cargo,
        ),
      };
      activeIncursionRef.current = next;
      return next;
    });

    appendRunLog(
      `>> VECTOR ENGAGED — NODE ${inc.nodesCleared + 1} // ${engagedNode.label.split(' // ').slice(1).join(' // ') || engagedNode.label}`,
    );

    if (engagedNode.type === 'EMERGENCY_EXTRACTION') {
      appendRunLog('>> EMERGENCY EXTRACTION LINK ENGAGED — EVAC CONDUIT OPEN.');
      return engagedNode.type;
    }

    if (engagedNode.type === 'RESOURCE_HARVEST') {
      const treeNode = inc.proceduralRunTree?.nodes[engagedNode.id];
      const depth = inc.nodesCleared + 1;
      const pool = treeNode?.resourcePool?.length
        ? [...treeNode.resourcePool]
        : rollProceduralResourcePool(depth, `resource-engage:${engagedNode.id}`);
      beginResourceNodeHarvest(pool);
      return engagedNode.type;
    }

    if (engagedNode.type === 'STANDARD_COMBAT' || engagedNode.type === 'ELITE_COMBAT') {
      prepareStandardCombatEncounter(engagedNode);
      setActiveIncursion((prev) => {
        const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
        activeIncursionRef.current = next;
        return next;
      });
      return engagedNode.type;
    }

    if (engagedNode.type === 'ANOMALY') {
      appendRunLog('>> ANALYZING UNIDENTIFIED SIGNAL...');
      const resolution = resolveAnomalyNode();
      appendRunLog(anomalyResolutionLogLine(resolution));
      setActiveIncursion((prev) => {
        const next = {
          ...prev,
          contractRunProgress: recordContractAnomalyCleared(prev.contractRunProgress),
        };
        activeIncursionRef.current = next;
        return next;
      });

      if (resolution === 'NARRATIVE') {
        assignNarrativeForCombat(engagedNode);
        setActiveIncursion((prev) => {
          const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
          activeIncursionRef.current = next;
          return next;
        });
        return 'NARRATIVE_EVENT';
      }

      if (resolution === 'AMBUSH_COMBAT') {
        setRunState((prev) => {
          const next = {
            ...prev,
            pendingAmbush: true,
            currentStamina: 0,
          };
          runStateRef.current = next;
          return next;
        });
        prepareStandardCombatEncounter({
          ...engagedNode,
          encounterType: 'COMBAT',
          type: 'STANDARD_COMBAT',
          label: engagedNode.label.replace('UNIDENTIFIED SIGNAL', 'AMBUSH MANIFEST'),
        });
        setActiveIncursion((prev) => {
          const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
          activeIncursionRef.current = next;
          return next;
        });
        return 'STANDARD_COMBAT';
      }

      if (resolution === 'RESOURCE_HARVEST') {
        const pool = rollProceduralResourcePool(
          inc.nodesCleared + 1,
          `anomaly-resource:${engagedNode.id}`,
        );
        beginResourceNodeHarvest(pool);
        return 'RESOURCE_HARVEST';
      }

      rollBlackMarketStockForNode();
      setActiveIncursion((prev) => {
        const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
        activeIncursionRef.current = next;
        return next;
      });
      return 'BLACK_MARKET';
    }

    if (engagedNode.type === 'NARRATIVE_EVENT') {
      assignNarrativeForCombat(engagedNode);
      setActiveIncursion((prev) => {
        const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
        activeIncursionRef.current = next;
        return next;
      });
      return engagedNode.type;
    }

    if (engagedNode.type === 'SANCTUARY' || engagedNode.type === 'BLACK_MARKET') {
      if (engagedNode.type === 'BLACK_MARKET') {
        rollBlackMarketStockForNode();
      }
      setActiveIncursion((prev) => {
        const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
        activeIncursionRef.current = next;
        return next;
      });
      return engagedNode.type;
    }

    if (engagedNode.type === 'BOSS_COMBAT') {
      prepareBossEncounter(engagedNode);
      setActiveIncursion((prev) => {
        const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
        activeIncursionRef.current = next;
        return next;
      });
      return engagedNode.type;
    }

    return null;
  }, [
    appendRunLog,
    applyVeilBleedHpCost,
    assignNarrativeForCombat,
    beginResourceNodeHarvest,
    prepareBossEncounter,
    preparePostCombatMutations,
    prepareStandardCombatEncounter,
    rollBlackMarketStockForNode,
  ]);

  const commitNodeEncounter = useCallback((nodeId: string): import('../types/game').RunNodeType | null => {
    let inc = activeIncursionRef.current;
    if (inc.mapMode !== 'SCANNING_HUB') return null;
    const expandedInc = persistExpandedSectorGraph(inc);
    if (expandedInc !== inc) {
      activeIncursionRef.current = expandedInc;
      setActiveIncursion(expandedInc);
      inc = expandedInc;
    }
    const cluster = buildSectorCluster(inc);
    const node = findVectorInCluster(cluster, nodeId);
    if (!node) return null;
    return engageVectorNode(node);
  }, [engageVectorNode]);

  const stageExtractionReview = useCallback((kind: ExtractionReviewKind, anchorIndex?: 1 | 2 | 3) => {
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        extractionReviewKind: kind,
        pendingSafeAnchorIndex: kind === 'SAFE_ANCHOR' ? (anchorIndex ?? null) : null,
        previewNodeId: null,
        scanConfirmOverlayVisible: false,
      };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const adjustResonance = useCallback((_amount: number, _reason: string): number => 0, []);

  const tickOverworldHazards = useCallback((
    player: { x: number; y: number },
    deltaMs: number,
  ): { gridHoundCaught: boolean } => {
    void player;
    void deltaMs;
    return { gridHoundCaught: false };
  }, []);

  const collectVeilEcho = useCallback((echoId: string): boolean => {
    const inc = activeIncursionRef.current;
    const echo = inc.overworldSession.veilEchoes.find((e) => e.id === echoId && !e.collected);
    if (!echo) return false;

    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        overworldSession: {
          ...prev.overworldSession,
          veilEchoes: prev.overworldSession.veilEchoes.map((e) =>
            e.id === echoId ? { ...e, collected: true } : e,
          ),
        },
      };
      activeIncursionRef.current = next;
      return next;
    });

    if (echo.rewardType === 'CREDITS') {
      setActiveIncursion((prev) => {
        const next = { ...prev, runCredits: prev.runCredits + echo.amount };
        activeIncursionRef.current = next;
        return next;
      });
      appendRunLog(`>> +${echo.amount} RUN CREDITS — VEIL ECHO CACHE`);
    } else {
      appendRunLog(`>> VEIL ECHO — +${echo.amount} resource shard(s) absorbed.`);
    }
    appendRunLog('>> SENSORY BREADCRUMB CONFIRMED — hidden cache extracted.');
    return true;
  }, [appendRunLog]);

  const acquireRawLeyBoon = useCallback((boonId: string): boolean => {
    const inc = activeIncursionRef.current;
    const node = inc.overworldSession.rawLeyBoons.find((b) => b.id === boonId && !b.claimed);
    if (!node) return false;

    adjustResonance(RAW_LEY_BOON_RESONANCE_COST, 'RAW LEY-LINE ACQUISITION');
    const debuff: RunStatusEffect = {
      id: `raw-boon-debuff-${boonId}`,
      label: 'Unrefined Ley Burn',
      description: `−${RAW_LEY_BOON_HP_DEBUFF_PCT}% max health until next Safehouse.`,
      source: 'HAZARD',
      expiresAtSafehouse: true,
    };

    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        overworldSession: {
          ...prev.overworldSession,
          rawLeyBoons: prev.overworldSession.rawLeyBoons.map((b) =>
            b.id === boonId ? { ...b, claimed: true } : b,
          ),
          rawBoonsClaimedThisDistrict: prev.overworldSession.rawBoonsClaimedThisDistrict + 1,
        },
        runStatusEffects: [...prev.runStatusEffects, debuff],
      };
      activeIncursionRef.current = next;
      return next;
    });

    setRunState((prev) => {
      const maxSoulAnchor = Math.max(
        1,
        Math.floor(prev.maxSoulAnchor * (1 - RAW_LEY_BOON_HP_DEBUFF_PCT / 100)),
      );
      const soulAnchorIntegrity = Math.min(prev.soulAnchorIntegrity, maxSoulAnchor);
      const next = { ...prev, maxSoulAnchor, soulAnchorIntegrity };
      runStateRef.current = next;
      return next;
    });

    const activeClass = inc.activeClass ?? 'AEGIS';
    if (activeClass === 'HEX_SHOT') {
      applyHexShotBoon(node.boonId as HexShotBoonId);
    } else if (activeClass === 'ENVOY') {
      applyEnvoyBoon(node.boonId as EnvoyBoonId);
    } else {
      applyLeyLineMutation(node.boonId as LeyLineMutationId);
    }
    appendRunLog(`>> RAW LEY-LINE NODE — ${getClassBoonDisplayName(activeClass, node.boonId)} acquired.`);
    return true;
  }, [
    adjustResonance,
    applyEnvoyBoon,
    applyHexShotBoon,
    applyLeyLineMutation,
    appendRunLog,
  ]);

  const fireDirectedPing = useCallback((facing: AegisFacing) => {
    adjustResonance(DIRECTED_PING_RESONANCE_COST, 'DIRECTED PING');
    appendRunLog(`>> DIRECTED PING — echolocation burst (${facing.toUpperCase()}).`);
  }, [adjustResonance, appendRunLog]);

  const swapLeyLineMutation = useCallback((outgoingId: LeyLineMutationId) => {
    const inc = activeIncursionRef.current;
    const incoming = inc.pendingLeyBoonSwap?.incomingMutationId;
    if (!incoming) return;

    setRunState((prev) => {
      const maxSoulAnchor = Math.max(
        1,
        Math.floor(prev.maxSoulAnchor * (1 - LEY_BOON_SWAP_HP_COST_PCT / 100)),
      );
      const soulAnchorIntegrity = Math.min(prev.soulAnchorIntegrity, maxSoulAnchor);
      const next = { ...prev, maxSoulAnchor, soulAnchorIntegrity };
      runStateRef.current = next;
      return next;
    });

    setActiveIncursion((prev) => {
      const without = prev.leyLineMutations.filter((id) => id !== outgoingId);
      const next = {
        ...prev,
        leyLineMutations: [...without, incoming],
        pendingLeyBoonSwap: null,
      };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog(`>> LEY-LINE SWAP — ${outgoingId.replace(/_/g, ' ')} replaced (HP cost applied).`);
  }, [appendRunLog]);

  const cancelLeyBoonSwap = useCallback(() => {
    setActiveIncursion((prev) => {
      const next = { ...prev, pendingLeyBoonSwap: null };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog('>> INCOMING LEY-LINE BOON DECLINED.');
  }, [appendRunLog]);

  const swapClassBoon = useCallback((outgoingId: string) => {
    const inc = activeIncursionRef.current;
    const pending = inc.pendingClassBoonSwap;
    if (!pending) return;

    setRunState((prev) => {
      const maxSoulAnchor = Math.max(
        1,
        Math.floor(prev.maxSoulAnchor * (1 - LEY_BOON_SWAP_HP_COST_PCT / 100)),
      );
      const soulAnchorIntegrity = Math.min(prev.soulAnchorIntegrity, maxSoulAnchor);
      const next = { ...prev, maxSoulAnchor, soulAnchorIntegrity };
      runStateRef.current = next;
      return next;
    });

    setActiveIncursion((prev) => {
      if (pending.classId === 'HEX_SHOT') {
        const without = prev.hexShotBoons.filter((id) => id !== outgoingId);
        const next = {
          ...prev,
          hexShotBoons: [...without, pending.incomingBoonId as HexShotBoonId],
          pendingClassBoonSwap: null,
        };
        activeIncursionRef.current = next;
        return next;
      }
      const without = prev.envoyBoons.filter((id) => id !== outgoingId);
      const next = {
        ...prev,
        envoyBoons: [...without, pending.incomingBoonId as EnvoyBoonId],
        pendingClassBoonSwap: null,
      };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog(`>> ${pending.classId} BOON SWAP — ${outgoingId.replace(/_/g, ' ')} replaced (HP cost applied).`);
  }, [appendRunLog]);

  const cancelClassBoonSwap = useCallback(() => {
    setActiveIncursion((prev) => {
      const next = { ...prev, pendingClassBoonSwap: null };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog('>> INCOMING CLASS BOON DECLINED.');
  }, [appendRunLog]);

  const prepareGridHoundEncounter = useCallback(() => {
    beginCombatRunLogSession();
    const inc = activeIncursionRef.current;
    const prev = runStateRef.current;
    const sector = prev.currentSector ?? INITIAL_SECTOR_POOL[0];
    const pendingEnemies = squadFromSingleEnemy(spawnGridHoundProfile(inc.nodesCleared));
    const pendingEnemy = pendingEnemies[0] ?? null;
    const envModifiers = buildEnvironmentalModifiersForNode(inc.resonance.percent);

    setActiveIncursion((prevState) => ({
      ...prevState,
      environmentalModifiers: envModifiers,
      overworldSession: {
        ...prevState.overworldSession,
        gridHound: prevState.overworldSession.gridHound
          ? { ...prevState.overworldSession.gridHound, caught: true, active: false }
          : null,
      },
    }));
    activeIncursionRef.current = {
      ...activeIncursionRef.current,
      environmentalModifiers: envModifiers,
    };

    setRunState((prevState) => {
      const next = {
        ...prevState,
        currentSector: sector,
        pendingEnemy,
        pendingEnemies,
        pendingEncounter: buildEncounter(
          inc.currentEncounterIndex,
          sector,
          'COMBAT',
          'GRID-HOUND INTERCEPT // MANDATORY FIGHT',
        ),
        pendingAmbush: true,
      };
      runStateRef.current = next;
      return next;
    });

    appendRunLog('>> GRID-HOUND ENGAGED — APEX AMBUSH COMBAT LOCKED.');
    if (pendingEnemy) {
      appendRunLog(`>> HOSTILE SIGNATURE: ${pendingEnemy.designation} [${pendingEnemy.class}] HP ${pendingEnemy.maxHp}.`);
    }
  }, [appendRunLog, beginCombatRunLogSession]);

  const applyResonanceManifestScan = useCallback((_nodeId: string) => {
    // Resonance mechanic disabled — manifest scans no longer accrue heat.
  }, []);

  const getSafehouseIntel = useCallback(() => {
    const inc = activeIncursionRef.current;
    return buildDistrictIntelForRun(inc.currentDistrict, inc.runGenerationContext);
  }, []);

  const transferRunCargoToBankVault = useCallback((percent: number) => {
    if (percent < 100) {
      const inc = activeIncursionRef.current;
      const result = transferRunCargoToBank(
        inc.cargo,
        { totalValue: 0, lastTransferValue: 0 },
        percent,
      );
      if (!result) {
        return { success: false, logLine: '>> PARTIAL TRANSFER FAILED — NO CARGO TO BANK.' };
      }
      setActiveIncursion((prev) => {
        const next = {
          ...prev,
          cargo: result.cargo,
          unstableCargoEffectsSeen: mergeUnstableCargoEffectsSeen(
            prev.unstableCargoEffectsSeen,
            result.cargo,
          ),
        };
        activeIncursionRef.current = next;
        return next;
      });
      return {
        success: true,
        logLine: `>> PARTIAL VALUE TRANSFER — ${result.transferredValue} VALUE PURGED FROM CARGO.`,
        transferredValue: result.transferredValue,
      };
    }

    const inc = activeIncursionRef.current;
    const bankResult = bankAllPhysicalRunCargo(inc.cargo, inc.runBankedSnapshot);
    if (Object.keys(bankResult.bankedResources).length === 0
      && Object.keys(bankResult.bankedConsumables).length === 0) {
      return { success: false, logLine: '>> CARGO BANK FAILED — NO PHYSICAL PAYLOAD TO SECURE.' };
    }

    const { resourceCount, consumableCount } = summarizeBankSnapshot(bankResult.bank);
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        cargo: bankResult.cargo,
        runBankedSnapshot: bankResult.bank,
        unstableCargoEffectsSeen: mergeUnstableCargoEffectsSeen(
          prev.unstableCargoEffectsSeen,
          bankResult.cargo,
        ),
        runResourceLedger: recordSafehouseBankAction(
          recordResourcesBanked(prev.runResourceLedger, bankResult.bankedResources),
        ),
      };
      activeIncursionRef.current = next;
      return next;
    });

    return {
      success: true,
      logLine: `>> CARGO BANKED AT SAFEHOUSE — ${resourceCount} RESOURCE(S), ${consumableCount} ITEM(S) SECURED. SURVIVES DEATH IF NOT RE-LOOTED.`,
      transferredValue: 0,
    };
  }, []);

  const vaultIncursionVeilResidueToAccount = useCallback((): { deposited: number } => {
    const inc = activeIncursionRef.current;
    const { totalDeposit, cargoForStash } = resolveExtractionVeilResidueDeposit(
      inc.cargo,
      inc.sessionVeilResidueCollected,
    );
    if (totalDeposit <= 0) return { deposited: 0 };
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        sessionVeilResidueCollected: 0,
        runVeilResidueBaseline: 0,
        cargo: cargoForStash,
      };
      activeIncursionRef.current = next;
      return next;
    });
    return { deposited: totalDeposit };
  }, []);

  const restoreHealthFromBench = useCallback(() => {
    const inc = activeIncursionRef.current;
    const run = runStateRef.current;
    const bench = applyBenchHealthRestore(
      inc.cargo,
      10,
      run.soulAnchorIntegrity,
      run.maxSoulAnchor,
    );
    if (!bench) {
      return { success: false, logLine: '>> BENCH RESTORE FAILED — INSUFFICIENT CARGO.' };
    }
    const cargoHealMultiplier = resolveCargoHealReceivedMultiplier(inc.cargo);
    const restoreAmount = Math.floor(run.maxSoulAnchor * 0.25 * cargoHealMultiplier);
    const nextHp = Math.min(run.maxSoulAnchor, run.soulAnchorIntegrity + restoreAmount);
    setActiveIncursion((prev) => {
      const next = { ...prev, cargo: bench.cargo };
      activeIncursionRef.current = next;
      return next;
    });
    setRunState((prev) => {
      const next = { ...prev, soulAnchorIntegrity: nextHp };
      runStateRef.current = next;
      return next;
    });
    return {
      success: true,
      logLine: `>> BENCH RESTORE — +25% HEALTH (${bench.cargoSpent} CARGO VALUE CONSUMED).`,
    };
  }, []);

  const transitionToNextDistrict = useCallback(() => {
    const inc = activeIncursionRef.current;
    if (inc.mapMode !== 'SAFEHOUSE_INTERMISSION') return;

    const depthIndex = inc.currentDistrict as 1 | 2 | 3;
    const proceduralRunTree = regenerateProceduralRunTree(
      depthIndex,
      inc.runGenerationContext,
      `district-${depthIndex}:${inc.nodesCleared}:${Date.now()}`,
    );

    const nextPatrolState = createEmptyPatrolState();
    const next: ActiveIncursionState = persistExpandedSectorGraph({
      ...inc,
      resonance: { percent: 0 },
      patrolState: nextPatrolState,
      mapMode: 'SCANNING_HUB',
      resonanceManifestNodeIds: [],
      proceduralRunTree,
      revealedSonarNodeIds: [],
    });

    activeIncursionRef.current = next;
    setActiveIncursion(next);
    setScanSessionKey((k) => k + 1);
    const depthStage = depthIndex === 1 ? 'THRESHOLD' : depthIndex === 2 ? 'BREACH' : 'DEEP_VEIL';
    appendRunLog(`>> UNSEAL DOOR — ENTERING DISTRICT ${next.currentDistrict} // ${depthStage}.`);
    appendRunLog(`>> PROCEDURAL VECTOR MAP REGENERATED — ${proceduralRunTree.maxDepth} LAYERS // D${depthIndex}.`);
  }, [appendRunLog]);

  const stageSafeAnchorReview = useCallback((anchorIndex: 1 | 2 | 3) => {
    stageExtractionReview('SAFE_ANCHOR', anchorIndex);
    appendRunLog(`>> SAFE ANCHOR ${anchorIndex} — CLEAN EVAC REVIEW STAGED.`);
  }, [appendRunLog, stageExtractionReview]);

  const confirmSafeAnchorExtraction = useCallback((anchorIndex: 1 | 2 | 3) => {
    setActiveIncursion((prev) => {
      const cleared = prev.clearedSafeAnchors.includes(anchorIndex)
        ? prev.clearedSafeAnchors
        : [...prev.clearedSafeAnchors, anchorIndex];
      const next = {
        ...prev,
        clearedSafeAnchors: cleared,
        pendingSafeAnchorIndex: null,
        extractionReviewKind: null,
      };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog(`>> SAFE ANCHOR ${anchorIndex} — CLEAN EXTRACTION CONFIRMED. NO PENALTY.`);
  }, [appendRunLog]);

  const continueFromExtractionReview = useCallback(() => {
    const kind = activeIncursionRef.current.extractionReviewKind;
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        pendingSafeAnchorIndex: null,
        extractionReviewKind: null,
      };
      activeIncursionRef.current = next;
      return next;
    });
    if (kind === 'MASTER_LINK') {
      appendRunLog('>> INCURSION CONTINUES — master link bypassed. Collapse rift accessible.');
    } else if (kind === 'EMERGENCY_RECALL') {
      appendRunLog('>> INCURSION CONTINUES — emergency evac aborted.');
    } else {
      appendRunLog('>> INCURSION CONTINUES — safe anchor bypassed.');
    }
  }, [appendRunLog]);

  const initiateEmergencyRecall = useCallback((): boolean => {
    const inc = activeIncursionRef.current;
    if (!isEmergencyRecallAvailable(inc.nodesCleared)) {
      appendRunLog('[REJECTED] >> Emergency recall offline — window is nodes 5–15 only.');
      return false;
    }
    if (inc.defendRiftActive) return false;
    if (hasVeilAshCanisterCarried(inc.cargo)) {
      appendRunLog(formatEmergencyRecallVeilAshWarning());
    }
    appendRunLog('>> EMERGENCY RECALL INITIATED — elite intercept staging.');
    prepareDefendRiftEncounter();
    return true;
  }, [appendRunLog, prepareDefendRiftEncounter]);

  const completeDefendRiftVictory = useCallback(() => {
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        defendRiftActive: false,
        extractionReviewKind: 'EMERGENCY_RECALL' as const,
        mapMode: 'SCANNING_HUB' as IncursionMapMode,
      };
      activeIncursionRef.current = next;
      return next;
    });
    setRunState((prev) => {
      const next = { ...prev, pendingEnemy: null, pendingEnemies: [], pendingEncounter: null };
      runStateRef.current = next;
      return next;
    });
    appendRunLog('>> EMERGENCY RECALL CLEARED — emergency evac review opening.');
    appendRunLog('>> WARNING — 20% cargo value bleed on emergency extraction.');
  }, [appendRunLog]);

  const confirmMasterExtraction = useCallback(() => {
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        masterLinkUsed: true,
        extractionReviewKind: null,
        pendingSafeAnchorIndex: null,
      };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog('>> MASTER EXTRACTION LINK — GUARANTEED CLEAN EXIT CONFIRMED.');
  }, [appendRunLog]);

  const applyEmergencyRecallCargoBleed = useCallback((): number => {
    const inc = activeIncursionRef.current;
    const bleedResult = applyEmergencyExtractBleed(inc.cargo, EMERGENCY_EXTRACT_CARGO_BLEED_PCT);
    if (bleedResult.drainedValue > 0) {
      setActiveIncursion((prev) => {
        const next = {
          ...prev,
          cargo: bleedResult.cargo,
          extractionReviewKind: null,
          unstableCargoEffectsSeen: mergeUnstableCargoEffectsSeen(
            prev.unstableCargoEffectsSeen,
            bleedResult.cargo,
          ),
          contractRunProgress: recordContractEmergencyRecall(prev.contractRunProgress),
        };
        activeIncursionRef.current = next;
        return next;
      });
      appendRunLog(`>> EMERGENCY EXTRACT BLEED — −${bleedResult.drainedValue} cargo value purged.`);
    } else {
      setActiveIncursion((prev) => {
        const next = {
          ...prev,
          extractionReviewKind: null,
          contractRunProgress: recordContractEmergencyRecall(prev.contractRunProgress),
        };
        activeIncursionRef.current = next;
        return next;
      });
    }
    return bleedResult.drainedValue;
  }, [appendRunLog]);

  const confirmScanPreview = useCallback((): import('../types/game').RunNodeType | null => {
    const inc = activeIncursionRef.current;
    if (!inc.previewNodeId) return null;

    const nodeId = inc.previewNodeId;
    const cluster = buildSectorCluster(inc);
    const node = findVectorInCluster(cluster, nodeId);
    if (!node) return null;

    if (node.type === 'SAFE_ANCHOR_EXTRACTION' && node.safeAnchorIndex != null) {
      appendRunLog('>> SAFE ANCHOR ENGAGED — extraction review opening.');
      stageSafeAnchorReview(node.safeAnchorIndex);
      return node.type;
    }

    if (node.type === 'MASTER_EXTRACTION_LINK') {
      appendRunLog('>> MASTER EXTRACTION LINK ENGAGED — prime evac review opening.');
      stageExtractionReview('MASTER_LINK');
      return node.type;
    }

    setActiveIncursion((prev) => {
      const next = { ...prev, previewNodeId: null, scanConfirmOverlayVisible: false };
      activeIncursionRef.current = next;
      return next;
    });

    appendRunLog('>> BREACH BLIND ENGAGE — vector lock confirmed.');
    return engageVectorNode(node);
  }, [appendRunLog, engageVectorNode, stageExtractionReview, stageSafeAnchorReview]);

  const shiftBossPhase = useCallback((phase: number) => {
    setActiveIncursion((prev) => {
      if (!prev.bossProfile) return prev;
      const next = {
        ...prev,
        bossProfile: { ...prev.bossProfile, currentPhase: phase },
      };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const setPendingAmbush = useCallback((value: boolean) => {
    setRunState((prev) => ({ ...prev, pendingAmbush: value }));
  }, []);

  const clearPendingAmbush = useCallback(() => {
    const wasStalker = runStateRef.current.pendingEnemy?.isVeilStalker === true;
    setRunState((prev) => ({ ...prev, pendingAmbush: false }));
    if (wasStalker) {
      setActiveIncursion((prev) => {
        const next = {
          ...prev,
          resonanceEscalations: clearVeilStalkerHunt(prev.resonanceEscalations),
        };
        activeIncursionRef.current = next;
        return next;
      });
      appendRunLog('>> VEIL STALKER ERADICATED — hunter flag cleared.');
    }
  }, [appendRunLog]);

  const useIncursionConsumable = useCallback((itemId: CargoItemId): IncursionConsumableUseResult | null => {
    const inc = activeIncursionRef.current;
    const def = CARGO_ITEM_CATALOG[itemId];
    if (!def?.usableInCombat || def.combatEffect === 'unimplemented' || !hasCargoItem(inc.cargo, itemId)) {
      return null;
    }

    const nextCargo = consumeCargoItem(inc.cargo, itemId);
    if (!nextCargo) return null;

    const run = runStateRef.current;
    let healAmount = 0;
    let stunsEnemy = false;
    let logLine = '';
    const result: IncursionConsumableUseResult = {
      itemId,
      healAmount: 0,
      stunsEnemy: false,
      logLine: '',
    };

    switch (def.combatEffect) {
      case 'stun':
        stunsEnemy = true;
        logLine = '>> VEIL SHARD DEPLOYED — Hostile neural lock engaged.';
        break;
      case 'heal': {
        const healPercent = def.healPercent ?? 0;
        healAmount = Math.floor(run.maxSoulAnchor * (healPercent / 100));
        logLine = `>> SOUL CORE DEPLOYED — +${healPercent}% Soul Anchor (+${healAmount} HP).`;
        break;
      }
      case 'max_fracture':
        stunsEnemy = true;
        logLine = '>> VEIL SHARD DEPLOYED — Fracture gauge maxed.';
        break;
      case 'stamina_ap_surge':
        result.restoreStaminaPct = 100;
        result.grantBonusAp = 1;
        logLine = '>> GRAVE-DUST AMPULE — Stamina maxed, +1 AP this turn.';
        break;
      case 'shatter_armor':
        result.shatterKineticArmor = 2;
        logLine = '>> GRID-CRACKER MAG — Up to 2 kinetic armor layers shattered.';
        break;
      case 'strip_wards':
        result.stripOccultWards = 2;
        logLine = '>> ECLIPSE FLARE — Up to 2 occult ward layers burned away.';
        break;
      case 'clear_debuffs': {
        const healPercent = def.healPercent ?? 10;
        healAmount = Math.floor(run.maxSoulAnchor * (healPercent / 100));
        result.clearDebuffs = true;
        logLine = `>> COAGULATION STITCH — Debuffs cleared, +${healAmount} HP.`;
        break;
      }
      case 'max_abyssal':
        result.maxAbyssalReserve = true;
        logLine = '>> VOID-SURGE CATALYST — Abyssal Reserve overcharged to maximum.';
        break;
      case 'absorb_hit':
        result.absorbNextHit = true;
        logLine = '>> SPALL-WEAVE VEST — Next health damage fully absorbed.';
        break;
      case 'spectral_imbue':
        logLine = '>> SPECTRAL SALT APPLIED — weapon imbued with spectral essence.';
        break;
      case 'sanguine_coagulant': {
        const healPercent = def.healPercent ?? 50;
        healAmount = Math.floor(run.maxSoulAnchor * (healPercent / 100));
        result.clearPlayerDebuffs = ['BLEEDING', 'FRACTURED'];
        logLine = `>> SANGUINE COAGULANT — +${healAmount} HP, purging BLEEDING / FRACTURED.`;
        break;
      }
      case 'veil_ash_grenade':
        result.frontlineBlindTurns = 2;
        logLine = '>> VEIL-ASH GRENADE — frontline hostiles blinded for 2 turns.';
        break;
      case 'god_mode':
        result.enableGodMode = true;
        logLine = '>> GOD MODE — Operative overclocked. 1000 DMG STRIKE, resources locked at maximum.';
        break;
      default:
        return null;
    }

    setActiveIncursion((prev) => {
      const next: ActiveIncursionState = {
        ...prev,
        cargo: nextCargo,
        spectralWeaponImbued: def.combatEffect === 'spectral_imbue'
          ? true
          : prev.spectralWeaponImbued,
        godModeActive: def.combatEffect === 'god_mode' ? true : prev.godModeActive,
      };
      activeIncursionRef.current = next;
      return next;
    });

    if (def.combatEffect === 'god_mode') {
      setRunState((prev) => {
        const next = {
          ...prev,
          soulAnchorIntegrity: prev.maxSoulAnchor,
          currentStamina: prev.maxStamina,
        };
        runStateRef.current = next;
        return next;
      });
    }

    return {
      ...result,
      healAmount,
      stunsEnemy,
      apCost: def.apCost ?? 2,
      logLine,
    };
  }, []);

  const useResonanceBribeFromCargo = useCallback((): boolean => {
    appendRunLog('[REJECTED] >> Resonance tracking offline this incursion.');
    return false;
  }, [appendRunLog]);

  const useDeadDropTokenFromCargo = useCallback((): boolean => {
    const inc = activeIncursionRef.current;
    if (!hasCargoItem(inc.cargo, 'dead-drop-token')) return false;
    const containment = inc.cargo.containment[0];
    if (!containment) {
      appendRunLog('[REJECTED] >> Dead-Drop Token requires cargo in containment.');
      return false;
    }
    const nextCargo = consumeCargoItem(inc.cargo, 'dead-drop-token');
    if (!nextCargo) return false;
    const value = containment.currentValue ?? CARGO_ITEM_CATALOG[containment.itemId].baseValue;
    setActiveIncursion((prev) => {
      const stripped = {
        ...nextCargo,
        containment: nextCargo.containment.filter((c) => c.instanceId !== containment.instanceId),
      };
      const next = { ...prev, cargo: stripped };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog(`>> DEAD-DROP TOKEN — ${CARGO_ITEM_CATALOG[containment.itemId].name} secured to Cabal vault (+${value} CR value).`);
    return true;
  }, [appendRunLog]);

  const applyIncursionConsumableHeal = useCallback((amount: number) => {
    const cargoMultiplier = resolveCargoHealReceivedMultiplier(activeIncursionRef.current.cargo);
    const effectiveAmount = Math.floor(amount * cargoMultiplier);
    setRunState((prev) => {
      const next = {
        ...prev,
        soulAnchorIntegrity: Math.min(prev.maxSoulAnchor, prev.soulAnchorIntegrity + effectiveAmount),
      };
      runStateRef.current = next;
      return next;
    });
  }, []);

  const awardRunCredits = useCallback((amount: number, reason: string) => {
    if (amount <= 0) return;
    setActiveIncursion((prev) => {
      const next = { ...prev, runCredits: prev.runCredits + amount };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog(`>> +${amount} RUN CREDITS — ${reason}`);
  }, [appendRunLog]);

  const setAegisLoadout = useCallback((loadout: AegisLoadout) => {
    setActiveIncursion((prev) => {
      const next = { ...prev, aegisLoadout: [...loadout] as AegisLoadout };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const setHexShotLoadout = useCallback((loadout: HexShotLoadout) => {
    const sanitized = sanitizeHexShotCombatLoadout(loadout);
    setActiveIncursion((prev) => {
      const next = { ...prev, hexShotLoadout: sanitized };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const setEnvoyLoadout = useCallback((loadout: EnvoyLoadout) => {
    const sanitized = sanitizeEnvoyCombatLoadout(loadout);
    setActiveIncursion((prev) => {
      const next = { ...prev, envoyLoadout: sanitized };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const purchaseBlackMarketCargo = useCallback((itemId: CargoItemId): { success: boolean; logLine: string } | null => {
    const inc = activeIncursionRef.current;
    const stock = inc.blackMarketStock.length > 0 ? inc.blackMarketStock : rollBlackMarketStock();
    const listing = listingsForStock(stock).find((entry) => entry.id === itemId)
      ?? listingsForStock(rollBlackMarketStock()).find((entry) => entry.id === itemId);
    const basePrice = listing?.price ?? CARGO_ITEM_CATALOG[itemId]?.baseValue ?? 60;
    const discountPct = getBlackMarketDiscountPct(inc);
    const price = getEffectiveBlackMarketPrice(basePrice, discountPct);
    if (stock.length > 0 && !stock.includes(itemId)) {
      return { success: false, logLine: '[REJECTED] >> Item not in current market stock.' };
    }
    if (inc.runCredits < price) {
      return { success: false, logLine: '[REJECTED] >> Insufficient run credits for cargo purchase.' };
    }

    setActiveIncursion((prev) => {
      const nextCargo = addLootToContainment(prev.cargo, itemId, 1);
      let nextReq = prev.boundRequisition;
      if (nextReq?.scavengerMarkBlackMarketPending) {
        nextReq = consumeScavengerMarkDiscount(nextReq);
      }
      const next = {
        ...prev,
        runCredits: prev.runCredits - price,
        cargo: nextCargo,
        boundRequisition: nextReq,
      };
      activeIncursionRef.current = next;
      return next;
    });

    const discountNote = discountPct > 0 ? ` // SCAVENGER MARK -${discountPct}%` : '';
    return {
      success: true,
      logLine: `>> BLACK MARKET CARGO — ${CARGO_ITEM_CATALOG[itemId].name} staged in containment. -${price} RUN CREDITS.${discountNote}`,
    };
  }, []);

  const purchaseBlackMarketCargoAtCell = useCallback((
    itemId: CargoItemId,
    row: number,
    col: number,
  ): { success: boolean; logLine: string } | null => {
    const inc = activeIncursionRef.current;
    const stock = inc.blackMarketStock.length > 0 ? inc.blackMarketStock : rollBlackMarketStock();
    if (stock.length > 0 && !stock.includes(itemId)) {
      return { success: false, logLine: '[REJECTED] >> Item not in current market stock.' };
    }
    const placed = placeStagedBlackMarketCargoAtCell(inc.cargo, itemId, row, col);
    if (!placed) {
      return { success: false, logLine: '[REJECTED] >> Grid cell blocked — cannot stage contraband here.' };
    }

    const stockIndex = stock.indexOf(itemId);
    const nextStock = stockIndex >= 0
      ? [...stock.slice(0, stockIndex), ...stock.slice(stockIndex + 1)]
      : stock;

    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        blackMarketStock: nextStock,
        cargo: placed,
      };
      activeIncursionRef.current = next;
      return next;
    });

    return {
      success: true,
      logLine: `>> BLACK MARKET — ${CARGO_ITEM_CATALOG[itemId].name} staged on cargo grid. Bind to purchase.`,
    };
  }, []);

  const returnStagedBlackMarketCargo = useCallback((instanceId: string): { success: boolean; logLine: string } | null => {
    const inc = activeIncursionRef.current;
    const staged = inc.cargo.grid.placed.find((item) => item.instanceId === instanceId);
    if (!staged?.blackMarketStaged) {
      return { success: false, logLine: '[REJECTED] >> Only staged market cargo can be returned to manifest.' };
    }

    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        blackMarketStock: [...prev.blackMarketStock, staged.itemId],
        cargo: removePlacedCargoItem(prev.cargo, instanceId),
      };
      activeIncursionRef.current = next;
      return next;
    });

    return {
      success: true,
      logLine: `>> MANIFEST RETURN — ${CARGO_ITEM_CATALOG[staged.itemId].name} returned to cache stock.`,
    };
  }, []);

  const commitBlackMarketBindings = useCallback((): { success: boolean; logLine: string } | null => {
    const inc = activeIncursionRef.current;
    const staged = listStagedBlackMarketPlacements(inc.cargo);
    if (staged.length === 0) {
      return { success: false, logLine: '[REJECTED] >> No staged contraband to bind.' };
    }

    const discountPct = getBlackMarketDiscountPct(inc);
    const totalPrice = staged.reduce((sum, item) => {
      const base = resolveBlackMarketListingPrice(item.itemId);
      return sum + getEffectiveBlackMarketPrice(base, discountPct);
    }, 0);

    if (inc.runCredits < totalPrice) {
      return { success: false, logLine: '[REJECTED] >> Insufficient run credits to bind staged cargo.' };
    }

    setActiveIncursion((prev) => {
      let nextReq = prev.boundRequisition;
      if (nextReq?.scavengerMarkBlackMarketPending) {
        nextReq = consumeScavengerMarkDiscount(nextReq);
      }
      const next = {
        ...prev,
        runCredits: prev.runCredits - totalPrice,
        cargo: clearBlackMarketStagedFlags(prev.cargo),
        boundRequisition: nextReq,
      };
      activeIncursionRef.current = next;
      return next;
    });

    const discountNote = discountPct > 0 ? ` // SCAVENGER MARK -${discountPct}%` : '';
    return {
      success: true,
      logLine: `>> CARGO BOUND — ${staged.length} contraband item(s) secured. -${totalPrice} RUN CREDITS.${discountNote}`,
    };
  }, []);

  const sellPlacedCargoToBlackMarket = useCallback((instanceId: string): { success: boolean; logLine: string } | null => {
    const inc = activeIncursionRef.current;
    const placed = inc.cargo.grid.placed.find((item) => item.instanceId === instanceId);
    if (!placed) {
      return { success: false, logLine: '[REJECTED] >> Cargo item not found on grid.' };
    }
    if (placed.blackMarketStaged) {
      return { success: false, logLine: '[REJECTED] >> Return staged market cargo to manifest — cannot fence.' };
    }

    const payout = blackMarketFencePrice(placed.itemId);

    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        runCredits: prev.runCredits + payout,
        cargo: removePlacedCargoItem(prev.cargo, instanceId),
      };
      activeIncursionRef.current = next;
      return next;
    });

    return {
      success: true,
      logLine: `>> FENCE PAYOUT — ${CARGO_ITEM_CATALOG[placed.itemId].name} sold for ${payout} CR.`,
    };
  }, []);

  const revertBlackMarketStaging = useCallback(() => {
    const inc = activeIncursionRef.current;
    const staged = listStagedBlackMarketPlacements(inc.cargo);
    if (staged.length === 0) return;

    setActiveIncursion((prev) => {
      let nextCargo = prev.cargo;
      let nextStock = [...prev.blackMarketStock];
      staged.forEach((item) => {
        nextCargo = removePlacedCargoItem(nextCargo, item.instanceId);
        nextStock = [...nextStock, item.itemId];
      });
      const next = {
        ...prev,
        blackMarketStock: nextStock,
        cargo: nextCargo,
      };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      runState,
      devSandboxPreset: runState.devSandboxPreset,
      runLog,
      deathSummary,
      scanSessionKey,
      postCombatMutationChoices,
      appendRunLog,
      beginCombatRunLogSession,
      setCombatLogActive,
      clearRunLog,
      startNewRun,
      recordRunKillAttacker,
      boundRequisitionOffers,
      prepareBoundRequisitionOffers,
      confirmBoundRequisition,
      consumeAdrenalinePrimerAfterCombat,
      peekPendingNarrativeCombatBoons,
      clearPendingNarrativeCombatBoons,
      claimPendingNarrativeCombatBoons,
      clearNarrativeBoonStatusEffects,
      isPostCombatBoonBlocked,
      beginScanSession,
      commitRadarDot,
      advanceNode,
      completeNodeAfterMutation,
      incrementCombatNodesCleared,
      syncAfterCombat,
      refillStaminaAfterCombat,
      applyTrinket,
      preparePostCombatMutations,
      applyLeyLineMutation,
      applyHexShotBoon,
      applyEnvoyBoon,
      rollBlackMarketStockForNode,
      useResonanceBribeFromCargo,
      useDeadDropTokenFromCargo,
      applySkillCheckTier,
      applySanctuaryAttune,
      openSanctuaryGraftTerminal,
      applyClassGraftToAbility,
      getVeilResidueBalance,
      clearEncounterUltimateDisabled,
      getCurrentEncounter,
      getCurrentSkillCheck,
      endRun,
      getRunElapsedMs,
      getLastKillingEnemyDesignation,
      registerOperationContributionApplier,
      setPendingAmbush,
      clearPendingAmbush,
      assignNarrativeForCombat,
      getCurrentNarrativeNode,
      resolveNarrativeChoice,
      abortNarrativeEncounter,
      activeIncursion,
      getCurrentEncounterNode,
      getCurrentVectorCluster,
      syncProceduralScannerTypes,
      ensureScannerGraphExpanded,
      getSelectedVectorNode,
      openScanPreview,
      closeScanPreview,
      confirmScanPreview,
      getPreviewNode,
      stageEncounterClear,
      continueFromProgressCheckpoint,
      prepareBossEncounter,
      prepareStandardCombatEncounter,
      prepareHarvestAmbushEncounter,
      shiftBossPhase,
      setIncursionMapMode,
      purgeEncounterState,
      commitNodeEncounter,
      startBadgeTestCombat,
      startDevSandboxNode,
      finishBadgeTestCombat,
      finishDevSandbox,
      exitCombatToBadge,
      useIncursionConsumable,
      applyIncursionConsumableHeal,
      awardRunCredits,
      setAegisLoadout,
      setHexShotLoadout,
      setEnvoyLoadout,
      purchaseBlackMarketCargo,
      purchaseBlackMarketCargoAtCell,
      returnStagedBlackMarketCargo,
      commitBlackMarketBindings,
      sellPlacedCargoToBlackMarket,
      revertBlackMarketStaging,
      focusPreviewNode,
      spendAttunementCharge,
      calculateSectorExtractionPayout,
      placeCargoItem,
      relocateCargoItem,
      discardCargoInstance,
      applyHarvestChoice,
      useFocusingAmpouleFromCargo,
      useSonarPingOnNode,
      hasSonarPingInCargo,
      beginPostCombatHarvest,
      beginResourceNodeHarvest,
      beginResourceCachePack,
      finalizeHarvestScreen,
      grantCombatResourceDrops,
      grantCombatSalvage,
      applyVoidsTollSacrifice,
      absorbVeilResidueParticle,
      stageSafeAnchorReview,
      confirmSafeAnchorExtraction,
      continueFromExtractionReview,
      adjustResonance,
      applyResonanceManifestScan,
      transitionToNextDistrict,
      transferRunCargoToBankVault,
      vaultIncursionVeilResidueToAccount,
      restoreHealthFromBench,
      getSafehouseIntel,
      initiateEmergencyRecall,
      completeDefendRiftVictory,
      confirmMasterExtraction,
      applyEmergencyRecallCargoBleed,
      refreshOverworldFeatures,
      tickOverworldHazards,
      collectVeilEcho,
      acquireRawLeyBoon,
      fireDirectedPing,
      swapLeyLineMutation,
      cancelLeyBoonSwap,
      swapClassBoon,
      cancelClassBoonSwap,
      prepareGridHoundEncounter,
    }),
    [
      runState,
      runLog,
      deathSummary,
      scanSessionKey,
      postCombatMutationChoices,
      appendRunLog,
      beginCombatRunLogSession,
      setCombatLogActive,
      clearRunLog,
      startNewRun,
      boundRequisitionOffers,
      prepareBoundRequisitionOffers,
      confirmBoundRequisition,
      consumeAdrenalinePrimerAfterCombat,
      peekPendingNarrativeCombatBoons,
      clearPendingNarrativeCombatBoons,
      claimPendingNarrativeCombatBoons,
      clearNarrativeBoonStatusEffects,
      isPostCombatBoonBlocked,
      beginScanSession,
      commitRadarDot,
      advanceNode,
      completeNodeAfterMutation,
      incrementCombatNodesCleared,
      syncAfterCombat,
      refillStaminaAfterCombat,
      applyTrinket,
      preparePostCombatMutations,
      applyLeyLineMutation,
      applyHexShotBoon,
      applyEnvoyBoon,
      rollBlackMarketStockForNode,
      useResonanceBribeFromCargo,
      useDeadDropTokenFromCargo,
      applySkillCheckTier,
      applySanctuaryAttune,
      openSanctuaryGraftTerminal,
      applyClassGraftToAbility,
      getVeilResidueBalance,
      clearEncounterUltimateDisabled,
      getCurrentEncounter,
      getCurrentSkillCheck,
      endRun,
      getRunElapsedMs,
      getLastKillingEnemyDesignation,
      registerOperationContributionApplier,
      setPendingAmbush,
      clearPendingAmbush,
      assignNarrativeForCombat,
      getCurrentNarrativeNode,
      resolveNarrativeChoice,
      abortNarrativeEncounter,
      activeIncursion,
      getCurrentEncounterNode,
      getCurrentVectorCluster,
      syncProceduralScannerTypes,
      ensureScannerGraphExpanded,
      getSelectedVectorNode,
      openScanPreview,
      closeScanPreview,
      confirmScanPreview,
      getPreviewNode,
      stageEncounterClear,
      continueFromProgressCheckpoint,
      prepareBossEncounter,
      prepareStandardCombatEncounter,
      prepareHarvestAmbushEncounter,
      shiftBossPhase,
      setIncursionMapMode,
      purgeEncounterState,
      commitNodeEncounter,
      startBadgeTestCombat,
      startDevSandboxNode,
      finishBadgeTestCombat,
      finishDevSandbox,
      exitCombatToBadge,
      useIncursionConsumable,
      applyIncursionConsumableHeal,
      awardRunCredits,
      setAegisLoadout,
      setHexShotLoadout,
      setEnvoyLoadout,
      purchaseBlackMarketCargo,
      purchaseBlackMarketCargoAtCell,
      returnStagedBlackMarketCargo,
      commitBlackMarketBindings,
      sellPlacedCargoToBlackMarket,
      revertBlackMarketStaging,
      focusPreviewNode,
      spendAttunementCharge,
      calculateSectorExtractionPayout,
      placeCargoItem,
      relocateCargoItem,
      applyHarvestChoice,
      useFocusingAmpouleFromCargo,
      useSonarPingOnNode,
      hasSonarPingInCargo,
      beginPostCombatHarvest,
      beginResourceNodeHarvest,
      beginResourceCachePack,
      finalizeHarvestScreen,
      grantCombatResourceDrops,
      grantCombatSalvage,
      applyVoidsTollSacrifice,
      absorbVeilResidueParticle,
      stageSafeAnchorReview,
      confirmSafeAnchorExtraction,
      continueFromExtractionReview,
      adjustResonance,
      applyResonanceManifestScan,
      transitionToNextDistrict,
      transferRunCargoToBankVault,
      vaultIncursionVeilResidueToAccount,
      restoreHealthFromBench,
      getSafehouseIntel,
      initiateEmergencyRecall,
      completeDefendRiftVictory,
      confirmMasterExtraction,
      applyEmergencyRecallCargoBleed,
      refreshOverworldFeatures,
      tickOverworldHazards,
      collectVeilEcho,
      acquireRawLeyBoon,
      fireDirectedPing,
      swapLeyLineMutation,
      cancelLeyBoonSwap,
      swapClassBoon,
      cancelClassBoonSwap,
      prepareGridHoundEncounter,
    ],
  );

  return <RunContext.Provider value={value}>{children}</RunContext.Provider>;
}

export function useRun() {
  const context = useContext(RunContext);
  if (!context) {
    throw new Error('useRun must be used within a RunProvider');
  }
  return context;
}

export { pickRandomTrinkets, TRINKET_POOL };
