import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { pickRandomClimateCluster, getClusterDefinition } from '../data/climateClusters';
import {
  createEasyTestEnemy,
  createHardTestEnemy,
  spawnDefendRiftHordeProfile,
  spawnVeilStalkerProfile,
} from '../data/enemies';
import {
  applyEliteModifierToEnvironment,
  ELITE_MODIFIER_LABELS,
  rollEliteModifier,
} from '../data/eliteModifierEngine';
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
  createDefaultActiveIncursionState,
  FactionModifiers,
  IncursionMapMode,
  IncursionNode,
  NarrativeEventNode,
} from '../types/game';
import { initializeSectorRun } from '../data/macroStoryPipeline';
import {
  primeNarrativeEnvironment,
  resolveMatrixNarrativeChoice,
  rollVirtualD20,
} from '../data/narrativeEncounterMatrix';
import { pickSectorNarrativeForNode } from '../data/sectorNarrativeEngine';
import {
  harvestResonanceSpikeForTier,
} from '../data/resonanceProgressionEngine';
import {
  depthFromNodesCleared,
  getDistrictFromDepth,
  getUpcomingDistrictIntel,
  isDistrictGateDepth,
  isPrimeBossDepth,
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
  DEFEND_RIFT_SURVIVAL_TURNS,
  EMERGENCY_EXTRACT_CARGO_BLEED_PCT,
  MASTER_EXTRACTION_PAYOUT_MULTIPLIER,
} from '../types/sectorPacing';
import type { ExtractionReviewKind } from '../types/game';
import { ENVIRONMENT_DISPLAY_LABEL } from '../types/sector';
import {
  createBossProfileForDepth,
  findVectorInCluster,
  getBiomeContextLog,
  isBossNodeType,
} from '../data/descentEngine';
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
  affinityCombatLogLine,
  applyBlindBreachPenalty,
  buildEnvironmentalModifiersForNode,
  environmentAdvantageLogLine,
} from '../data/combatEnvironmentEngine';
import {
  addLootToContainment,
  applyDataBleedToCargo,
  applyEmergencyExtractBleed,
  buildHarvestLoot,
  calculateCargoMarketValue,
  calculateGridOccupancy,
  getCargoResonanceMultiplier,
  placeCargoFromContainment,
  relocateCargoItem as relocateCargoItemState,
  resetCargoInstanceCounter,
  scaledLootCount,
  hasCargoItem,
  consumeCargoItem,
} from '../data/cargoGridEngine';
import { CARGO_ITEM_CATALOG, HARVEST_YIELD_OPTIONS } from '../types/cargoGrid';
import type { HarvestYieldTier } from '../types/cargoGrid';
import {
  MAX_SECTOR_NODES,
  RESONANCE_TIER_DATA_BLEED,
  VEIL_STALKER_AMBUSH_CHANCE,
} from '../types/sector';
import { SANCTUARY_RETUNE_ATTUNEMENT } from '../types/sector';
import { districtBossLogLine } from '../data/districtBosses';
import { spawnDistrictBossSquad } from '../data/bossCombat';
import { createDefaultIncursionInventory } from '../data/incursionInventory';
import { encounterBudgetForDepth } from '../data/combatEncounterBudget';
import { spawnCombatSquad, squadFromSingleEnemy } from '../data/combatSpawnEngine';
import { listingsForStock, rollBlackMarketStock } from '../data/blackMarket';
import { pickRandomLeyLineMutations } from '../data/leyLineMutations';
import type { LeyLineMutationDefinition, LeyLineMutationId } from '../types/leyLineMutation';
import type { AegisLoadout } from '../types/aegisCombat';
import type { CargoItemId } from '../types/cargoGrid';
import type { IncursionConsumableId, IncursionConsumableUseResult } from '../types/incursionInventory';

export interface RunStartConfig {
  factionPerks?: FactionModifiers;
  unlockedBiomes?: BiomeType[];
  sectorTier?: number;
  aegisLoadout?: AegisLoadout;
}

interface RunContextType {
  runState: RunState;
  runLog: string[];
  scanSessionKey: number;
  postCombatMutationChoices: LeyLineMutationDefinition[];
  appendRunLog: (text: string) => void;
  startNewRun: (config?: RunStartConfig) => void;
  beginScanSession: () => void;
  commitRadarDot: (dot: RadarDot) => EncounterNode;
  advanceNode: () => { hasNext: boolean; completedCount: number };
  completeNodeAfterMutation: (mutationId: LeyLineMutationId) => void;
  incrementCombatNodesCleared: () => void;
  syncAfterCombat: (remainingHp: number, remainingStamina: number) => void;
  refillStaminaAfterCombat: () => void;
  applyTrinket: (trinket: Trinket) => void;
  preparePostCombatMutations: () => LeyLineMutationDefinition[];
  applyLeyLineMutation: (mutationId: LeyLineMutationId) => void;
  rollBlackMarketStockForNode: () => void;
  useResonanceBribeFromCargo: () => boolean;
  useDeadDropTokenFromCargo: () => boolean;
  applySkillCheckTier: (tier: 'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'CRITICAL_DESYNC', logLine: string) => void;
  applyRestChoice: (type: 'REST' | 'REPAIR' | 'RETUNE') => void;
  getCurrentEncounter: () => EncounterNode | null;
  getCurrentSkillCheck: () => SkillCheckEvent | null;
  endRun: (reason: string) => void;
  setPendingAmbush: (value: boolean) => void;
  clearPendingAmbush: () => void;
  assignNarrativeForCombat: (encounterNode?: IncursionNode | null) => void;
  getCurrentNarrativeNode: () => NarrativeEventNode | null;
  resolveNarrativeCheck: (choice: 'A' | 'B', status: CheckStatus) => string;
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
  restoreHealthFromBench: () => { success: boolean; logLine: string };
  getSafehouseIntel: () => import('../data/districtPacing').DistrictIntelBrief;
  focusPreviewNode: () => boolean;
  spendAttunementCharge: () => boolean;
  calculateSectorExtractionPayout: () => number;
  placeCargoItem: (instanceId: string, row: number, col: number) => boolean;
  relocateCargoItem: (instanceId: string, row: number, col: number) => boolean;
  applyHarvestChoice: (tier: HarvestYieldTier) => { logLines: string[]; ambushTriggered: boolean };
  useFocusingAmpouleFromCargo: () => boolean;
  beginPostCombatHarvest: () => void;
  beginResourceNodeHarvest: () => void;
  prepareBossEncounter: () => void;
  prepareStandardCombatEncounter: () => void;
  prepareHarvestAmbushEncounter: () => void;
  shiftBossPhase: (phase: number) => void;
  setIncursionMapMode: (mode: IncursionMapMode) => void;
  purgeEncounterState: () => void;
  commitNodeEncounter: (nodeId: string) => import('../types/game').RunNodeType | null;
  getCurrentVectorCluster: () => import('../types/game').IncursionNode[];
  ensureScannerGraphExpanded: () => void;
  getSelectedVectorNode: () => import('../types/game').IncursionNode | null;
  openScanPreview: (nodeId: string) => void;
  closeScanPreview: () => void;
  confirmScanPreview: () => import('../types/game').RunNodeType | null;
  getPreviewNode: () => import('../types/game').IncursionNode | null;
  startBadgeTestCombat: (preset: 'easy' | 'hard') => void;
  finishBadgeTestCombat: () => void;
  /** Clears run or badge test combat (caller navigates to hub / badge). */
  exitCombatToBadge: () => void;
  useIncursionConsumable: (itemId: CargoItemId) => IncursionConsumableUseResult | null;
  /** Applies consumable heal to run state (non-combat screens). */
  applyIncursionConsumableHeal: (amount: number) => void;
  awardRunCredits: (amount: number, reason: string) => void;
  setAegisLoadout: (loadout: AegisLoadout) => void;
  purchaseBlackMarketCargo: (itemId: CargoItemId) => { success: boolean; logLine: string } | null;
  stageSafeAnchorReview: (anchorIndex: 1 | 2 | 3) => void;
  confirmSafeAnchorExtraction: (anchorIndex: 1 | 2 | 3) => void;
  continueFromExtractionReview: () => void;
  adjustResonance: (amount: number, reason: string) => number;
  applyResonanceManifestScan: (nodeId: string) => void;
  initiateEmergencyRecall: () => boolean;
  completeDefendRiftVictory: () => void;
  confirmMasterExtraction: () => void;
  applyEmergencyRecallCargoBleed: () => number;
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

function buildSectorCluster(inc: ActiveIncursionState): IncursionNode[] {
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
  };
}

export function RunProvider({ children }: { children: React.ReactNode }) {
  const [runState, setRunState] = useState<RunState>(createInitialRunState);
  const runStateRef = useRef<RunState>(runState);
  const [runLog, setRunLog] = useState<string[]>([]);
  const [scanSessionKey, setScanSessionKey] = useState(0);
  const scanSessionKeyRef = useRef(scanSessionKey);
  scanSessionKeyRef.current = scanSessionKey;
  const [postCombatMutationChoices, setPostCombatMutationChoices] = useState<LeyLineMutationDefinition[]>([]);
  const [activeIncursion, setActiveIncursion] = useState<ActiveIncursionState>(
    createDefaultActiveIncursionState,
  );
  const activeIncursionRef = useRef<ActiveIncursionState>(activeIncursion);
  const narrativeNodeRef = useRef<NarrativeEventNode | null>(null);

  runStateRef.current = runState;
  activeIncursionRef.current = activeIncursion;

  const appendRunLog = useCallback((text: string) => {
    setRunLog((prev) => [...prev, text]);
  }, []);

  const startNewRun = useCallback((config?: RunStartConfig) => {
    const cluster = pickRandomClimateCluster();
    const clusterDef = getClusterDefinition(cluster);
    const hpBonus = config?.factionPerks?.maxHpBonus ?? 0;
    const stamBonus = config?.factionPerks?.maxStaminaBonus ?? 0;
    const maxSoulAnchor = BASE_MAX_SOUL_ANCHOR + hpBonus;
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
    const sectorInit = initializeSectorRun(sectorTier);
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
      currentNodeId: sectorInit.currentNodeId,
      nodesCleared: sectorInit.nodesCleared,
      attunement: sectorInit.attunement,
      resonance: sectorInit.resonance,
      focusedNodeIds: sectorInit.focusedNodeIds,
      bossDefeated: sectorInit.bossDefeated,
      primeExtractionBonus: sectorInit.primeExtractionBonus,
      sectorTier: sectorInit.sectorTier,
      leyLineMutations: [],
      blackMarketStock: [],
      aegisLoadout: config?.aegisLoadout
        ? [...config.aegisLoadout] as AegisLoadout
        : createDefaultActiveIncursionState().aegisLoadout,
    };
    activeIncursionRef.current = incursion;
    setActiveIncursion(incursion);
    narrativeNodeRef.current = null;
    resetCargoInstanceCounter();
    setScanSessionKey(1);
    setPostCombatMutationChoices([]);
    const biomeTag = (config?.unlockedBiomes ?? ['HOSPITAL', 'ALLEYWAYS']).join(', ');
    setRunLog([
      '>> RUN INITIALIZED — OPEN SECTOR ENGINE ONLINE.',
      `>> SECTOR TIER ${sectorTier} — BRANCHING TOPOLOGY PRE-GENERATED.`,
      `>> SCANNING HUB ACTIVE — SPECTRAL SWEEP INITIALIZING.`,
      `>> CLIMATE CLUSTER LOCKED: ${clusterDef.name}`,
      `>> AUTHORIZED BIOMES: ${biomeTag}`,
      `>> ${clusterDef.tagline}`,
      ...sectorInit.initLogLines,
    ]);
  }, []);

  const beginScanSession = useCallback(() => {
    setScanSessionKey((k) => k + 1);
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

  const completeNodeAfterMutation = useCallback((mutationId: LeyLineMutationId) => {
    applyLeyLineMutation(mutationId);
    setPostCombatMutationChoices([]);
  }, [applyLeyLineMutation]);

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
      const next = {
        ...prev,
        soulAnchorIntegrity: Math.min(Math.max(remainingHp, 0), prev.maxSoulAnchor),
        currentStamina: Math.min(Math.max(remainingStamina, 0), prev.maxStamina),
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

  const preparePostCombatMutations = useCallback((): LeyLineMutationDefinition[] => {
    const owned = activeIncursionRef.current.leyLineMutations;
    const choices = pickRandomLeyLineMutations(3, owned);
    setPostCombatMutationChoices(choices);
    return choices;
  }, []);

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
          pendingAmbush = true;
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

  const applyRestChoice = useCallback((type: 'REST' | 'REPAIR' | 'RETUNE') => {
    if (type === 'RETUNE') {
      setActiveIncursion((prev) => {
        const next = {
          ...prev,
          attunement: {
            ...prev.attunement,
            current: Math.min(prev.attunement.max, prev.attunement.current + SANCTUARY_RETUNE_ATTUNEMENT),
          },
        };
        activeIncursionRef.current = next;
        return next;
      });
      appendRunLog(`>> Sanctuary Re-Tune — +${SANCTUARY_RETUNE_ATTUNEMENT} attunement restored.`);
      return;
    }

    setRunState((prev) => {
      if (type === 'REPAIR') {
        const restore = Math.floor(prev.maxStamina * 0.25);
        const next = { ...prev, currentStamina: Math.min(prev.currentStamina + restore, prev.maxStamina) };
        runStateRef.current = next;
        return next;
      }
      const restore = Math.floor(prev.maxSoulAnchor * 0.25);
      const next = {
        ...prev,
        soulAnchorIntegrity: Math.min(prev.soulAnchorIntegrity + restore, prev.maxSoulAnchor),
      };
      runStateRef.current = next;
      return next;
    });
    appendRunLog(
      type === 'REST'
        ? '>> Sanctuary Rest — soul anchor integrity restored.'
        : '>> Field Repair — stamina reserves replenished.',
    );
  }, [appendRunLog]);

  const endRun = useCallback((reason: string) => {
    appendRunLog(`>> RUN TERMINATED — ${reason}`);
    const reset = createInitialRunState();
    runStateRef.current = reset;
    setRunState(reset);
    setPostCombatMutationChoices([]);
    const resetIncursion = createDefaultActiveIncursionState();
    activeIncursionRef.current = resetIncursion;
    setActiveIncursion(resetIncursion);
    narrativeNodeRef.current = null;
  }, [appendRunLog]);

  const startBadgeTestCombat = useCallback((preset: 'easy' | 'hard') => {
    const pendingEnemies = squadFromSingleEnemy(
      preset === 'easy' ? createEasyTestEnemy() : createHardTestEnemy(),
    );
    const pendingEnemy = pendingEnemies[0] ?? null;
    const next: RunState = {
      ...createInitialRunState(),
      runActive: true,
      maxSoulAnchor: BASE_MAX_SOUL_ANCHOR,
      soulAnchorIntegrity: BASE_MAX_SOUL_ANCHOR,
      maxStamina: BASE_MAX_STAMINA,
      currentStamina: BASE_MAX_STAMINA,
      currentSector: INITIAL_SECTOR_POOL[0],
      pendingEnemy,
      pendingEnemies,
      combatTestPreset: preset,
    };
    runStateRef.current = next;
    setRunState(next);
    const resetIncursion = createDefaultActiveIncursionState();
    activeIncursionRef.current = resetIncursion;
    setActiveIncursion(resetIncursion);
    narrativeNodeRef.current = null;
    setPostCombatMutationChoices([]);
    setRunLog([
      '>> BADGE TEST COMBAT — ISOLATED ARENA.',
      `>> HOSTILE: ${pendingEnemy?.designation ?? 'UNKNOWN'} // ${pendingEnemy?.maxHp ?? 0} HP.`,
      preset === 'easy'
        ? '>> ENEMY PROFILE: STRIKE ONLY.'
        : '>> ENEMY PROFILE: STANDARD ABILITIES (NO WORLD-ENDER).',
    ]);
  }, []);

  const finishBadgeTestCombat = useCallback(() => {
    const reset = createInitialRunState();
    runStateRef.current = reset;
    setRunState(reset);
    setPostCombatMutationChoices([]);
    const resetIncursion = createDefaultActiveIncursionState();
    activeIncursionRef.current = resetIncursion;
    setActiveIncursion(resetIncursion);
    narrativeNodeRef.current = null;
    appendRunLog('>> TEST COMBAT CONCLUDED — RETURNING TO IDENTITY BADGE.');
  }, [appendRunLog]);

  const exitCombatToBadge = useCallback(() => {
    if (runStateRef.current.combatTestPreset) {
      finishBadgeTestCombat();
      return;
    }
    endRun('OPERATIVE WITHDRAWAL — RUN ABORTED');
  }, [endRun, finishBadgeTestCombat]);

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
    const node = enrichNarrativeNode(
      pickSectorNarrativeForNode(vectorNode, inc.progress, inc.nodesCleared),
    );
    narrativeNodeRef.current = node;
    const primed = primeNarrativeEnvironment(node, vectorNode?.environmentType);
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
    if (vectorNode?.environmentType) {
      appendRunLog(`>> ENVIRONMENT LOCK — ${ENVIRONMENT_DISPLAY_LABEL[vectorNode.environmentType].toUpperCase()}.`);
    } else if (vectorNode?.biome) {
      appendRunLog(`>> ${getBiomeContextLog(vectorNode.biome)}`);
    }
    appendRunLog(`>> NARRATIVE VECTOR LOCKED — ${node.title}.`);
    appendRunLog('>> ENCOUNTER LAYER MOUNTED — FIELD CALIBRATION REQUIRED.');
  }, [appendRunLog, enrichNarrativeNode]);

  const getCurrentNarrativeNode = useCallback((): NarrativeEventNode | null => {
    return narrativeNodeRef.current;
  }, []);

  const resolveNarrativeCheck = useCallback((choice: 'A' | 'B', status: CheckStatus): string => {
    const node = narrativeNodeRef.current;
    if (!node) return '>> NARRATIVE RESOLVED — NO ACTIVE NODE.';

    const inc = activeIncursionRef.current;
    const prevRun = runStateRef.current;
    const matrixEventId = node.matrixEventId ?? node.id;
    const roll = rollVirtualD20();
    const result = resolveMatrixNarrativeChoice(
      matrixEventId,
      choice,
      roll,
      inc.progress,
      inc.environmentalModifiers,
      {
        maxSoulAnchor: prevRun.maxSoulAnchor,
        soulAnchorIntegrity: prevRun.soulAnchorIntegrity,
        maxStamina: prevRun.maxStamina,
        currentStamina: prevRun.currentStamina,
        startingAbyssalReservePercent: prevRun.startingAbyssalReservePercent,
      },
      inc.currentEncounterIndex,
      { forceSuccess: status === 'SUCCESS', forceFailure: status === 'FAILURE' },
      inc.cargo,
    );

    setActiveIncursion((prev) => {
      const next: ActiveIncursionState = {
        ...prev,
        progress: result.progress,
        environmentalModifiers: result.environmentalModifiers,
        lastCheckStatus: result.status,
        activeChoice: choice,
        cargo: result.cargoPatch ?? prev.cargo,
      };
      activeIncursionRef.current = next;
      return next;
    });

    setRunState((prev) => {
      const next = {
        ...prev,
        ...result.runPatch,
        pendingAmbush: result.triggerCombatAmbush ? true : prev.pendingAmbush,
      };
      runStateRef.current = next;
      return next;
    });

    result.logLines.forEach((line) => appendRunLog(line));
    return result.outcomeText;
  }, [appendRunLog]);

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
      appendRunLog('[REJECTED] >> INNER SANCTUM — attunement reveal offline. Breach blind only.');
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
    const cargoValue = calculateCargoMarketValue(inc.cargo);
    let total = inc.runCredits + pathBonus + cargoValue + 150;
    if (inc.primeExtractionBonus) total = Math.floor(total * 1.5);
    if (inc.masterLinkUsed) {
      total = Math.floor(total * MASTER_EXTRACTION_PAYOUT_MULTIPLIER);
    }
    if (getGreedZoneActive(inc.nodesCleared)) total = Math.floor(total * 1.25);
    return total;
  }, []);

  const relocateCargoItem = useCallback((instanceId: string, row: number, col: number): boolean => {
    const inc = activeIncursionRef.current;
    const wasInContainment = inc.cargo.containment.some((item) => item.instanceId === instanceId);
    const wasInGrid = inc.cargo.grid.placed.some((item) => item.instanceId === instanceId);
    const nextCargo = relocateCargoItemState(inc.cargo, instanceId, row, col);
    if (!nextCargo) return false;

    setActiveIncursion((prev) => {
      const next = { ...prev, cargo: nextCargo };
      activeIncursionRef.current = next;
      return next;
    });

    const occupancy = Math.round(calculateGridOccupancy(nextCargo) * 100);
    const occupancyNote = getCargoResonanceMultiplier(nextCargo) > 1
      ? ' — RESONANCE ×2 ACTIVE'
      : '';
    if (wasInContainment) {
      appendRunLog(`>> CARGO PACKED — grid occupancy ${occupancy}%${occupancyNote}.`);
    } else if (wasInGrid) {
      appendRunLog(`>> CARGO REPACKED — grid occupancy ${occupancy}%${occupancyNote}.`);
    }
    return true;
  }, [appendRunLog]);

  const placeCargoItem = relocateCargoItem;

  const applyHarvestChoice = useCallback((tier: HarvestYieldTier): { logLines: string[]; ambushTriggered: boolean } => {
    const inc = activeIncursionRef.current;
    const node = resolveActiveVectorNode(inc);
    const option = HARVEST_YIELD_OPTIONS.find((entry) => entry.tier === tier)!;
    const isElite = node?.type === 'ELITE_COMBAT' || node?.sectorMeta?.combatTier === 'ELITE';
    const lootIds = buildHarvestLoot(tier, inc.sectorTier, isElite, inc.nodesCleared);

    let nextCargo = inc.cargo;
    lootIds.forEach((itemId) => {
      const count = scaledLootCount(option.yieldPct, itemId === 'veil-residue-bulk' ? 1 : 1);
      nextCargo = addLootToContainment(nextCargo, itemId, count);
    });

    const harvestSpike = harvestResonanceSpikeForTier(tier);
    const harvestPatch = buildResonanceMutationPatch(
      inc,
      harvestSpike,
      scanSessionKeyRef.current,
    );
    harvestPatch.escalationLogLines.forEach((line) => appendRunLog(line));

    const ambushTriggered = Math.random() * 100 < option.ambushRiskPct;
    const logLines = [
      `>> ${option.label} — ${option.yieldPct}% yield routed to containment.`,
      `>> HARVEST SPIKE — RESONANCE +${harvestSpike}% (one-time).`,
    ];
    if (ambushTriggered) logLines.push('>> DEEP EXTRACT HEAT — hostile ambush frequency detected.');
    if (
      harvestPatch.patrolState.blipCount > 0
      && inc.patrolState.blipCount === 0
    ) {
      logLines.push(`>> PATROL CONTACT — ${harvestPatch.patrolState.blipCount} hostile signal(s) on Ley-Tracker.`);
    }

    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        cargo: nextCargo,
        resonance: { percent: harvestPatch.resonancePercent },
        resonanceEscalations: harvestPatch.resonanceEscalations,
        sectorGraph: harvestPatch.sectorGraph,
        patrolState: harvestPatch.patrolState,
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

  const beginPostCombatHarvest = useCallback(() => {
    setActiveIncursion((prev) => {
      const next = { ...prev, pendingHarvestReturn: 'POST_COMBAT' as const, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const beginResourceNodeHarvest = useCallback(() => {
    setActiveIncursion((prev) => {
      const next = { ...prev, pendingHarvestReturn: 'COMPLETE_NODE' as const, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
      activeIncursionRef.current = next;
      return next;
    });
  }, []);

  const prepareBossEncounter = useCallback(() => {
    const inc = activeIncursionRef.current;
    const encounterNode = resolveActiveVectorNode(inc);
    if (!encounterNode || !isBossNodeType(encounterNode.type)) return;

    const gateDepth = depthFromNodesCleared(inc.nodesCleared);
    const bossProfile = createBossProfileForDepth(gateDepth);
    const sector = runStateRef.current.currentSector ?? INITIAL_SECTOR_POOL[0];
    const pendingEnemies = spawnDistrictBossSquad(
      bossProfile,
      sector,
      inc.nodesCleared,
      gateDepth,
    );
    const pendingEnemy = pendingEnemies[0] ?? null;
    const envModifiers = buildEnvironmentalModifiersForNode(
      encounterNode.environmentType,
      inc.resonance.percent,
    );

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

    appendRunLog(`>> ${getBiomeContextLog(encounterNode.biome)}`);
    if (encounterNode.environmentType) {
      appendRunLog(environmentAdvantageLogLine(encounterNode.environmentType));
    }
    appendRunLog('>> AFFINITY CORPOREAL — prime anomaly dense tissue detected.');
    appendRunLog(districtBossLogLine(gateDepth));
    appendRunLog(`>> BOSS SIGNATURE: ${bossProfile.name} // ${bossProfile.maxHp} HP`);
  }, [appendRunLog]);

  const prepareStandardCombatEncounter = useCallback(() => {
    const inc = activeIncursionRef.current;
    const encounterNode = resolveActiveVectorNode(inc);
    if (
      !encounterNode
      || (encounterNode.type !== 'STANDARD_COMBAT' && encounterNode.type !== 'ELITE_COMBAT')
    ) return;

    const prev = runStateRef.current;
    const sector = prev.currentSector ?? INITIAL_SECTOR_POOL[0];
    const isElite = encounterNode.type === 'ELITE_COMBAT';
    let envModifiers = buildEnvironmentalModifiersForNode(
      encounterNode.environmentType,
      inc.resonance.percent,
    );
    if (isElite) {
      const modifier = rollEliteModifier(encounterNode.id);
      envModifiers = applyEliteModifierToEnvironment(envModifiers, modifier);
      appendRunLog(`>> ELITE MODIFIER — ${ELITE_MODIFIER_LABELS[modifier]}`);
    }
    const forcedAffinity = encounterNode.sectorMeta?.probableAffinity;
    const depth = depthFromNodesCleared(inc.nodesCleared);
    const district = getDistrictFromDepth(depth);
    const spawnBudget = encounterBudgetForDepth({
      depth,
      isElite,
      isAmbush: prev.pendingAmbush,
    });
    const pendingEnemies = spawnCombatSquad({
      nodeIndex: inc.nodesCleared,
      isElite,
      isAmbush: prev.pendingAmbush,
      district,
      spawnOptions: {
        resonancePercent: inc.resonance.percent,
        forcedAffinity,
      },
    });
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

    appendRunLog(`>> ${getBiomeContextLog(encounterNode.biome)}`);
    if (encounterNode.environmentType) {
      appendRunLog(environmentAdvantageLogLine(encounterNode.environmentType));
    }
    if (pendingEnemy?.affinity) {
      appendRunLog(affinityCombatLogLine(pendingEnemy.affinity));
    }
    appendRunLog(
      `>> HOSTILE CLUSTER — ${pendingEnemies.length} signature(s) // threat budget ${spawnBudget.spawnBudget} pts.`,
    );
    pendingEnemies.forEach((unit) => {
      appendRunLog(`>> — ${unit.designation} [${unit.class}] HP ${unit.currentHp} // ${unit.gridSlot ?? 'FL_0'}`);
    });
  }, [appendRunLog]);

  const prepareDefendRiftEncounter = useCallback(() => {
    const inc = activeIncursionRef.current;
    const prev = runStateRef.current;
    const sector = prev.currentSector ?? INITIAL_SECTOR_POOL[0];
    const envModifiers = {
      ...buildEnvironmentalModifiersForNode('BLEEDING_HIGH_RISE', inc.resonance.percent),
      combatObjective: 'SURVIVE_TURNS' as const,
      survivalTurnsRequired: DEFEND_RIFT_SURVIVAL_TURNS,
    };
    const pendingEnemies = squadFromSingleEnemy(spawnDefendRiftHordeProfile(inc.nodesCleared));
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
          'DEFEND THE RIFT // EMERGENCY RECALL',
        ),
      };
      runStateRef.current = next;
      return next;
    });

    appendRunLog('>> EMERGENCY RECALL — DEFEND THE RIFT PROTOCOL ENGAGED.');
    appendRunLog(`>> SURVIVE ${DEFEND_RIFT_SURVIVAL_TURNS} HOSTILE TURN CYCLES TO OPEN EVAC CONDUIT.`);
    appendRunLog(`>> HOSTILE SIGNATURE: ${pendingEnemy.designation} [${pendingEnemy.class}] HP ${pendingEnemy.maxHp}.`);
  }, [appendRunLog]);

  const prepareVeilStalkerEncounter = useCallback(() => {
    const inc = activeIncursionRef.current;
    const encounterNode = resolveActiveVectorNode(inc);
    const prev = runStateRef.current;
    const sector = prev.currentSector ?? INITIAL_SECTOR_POOL[0];
    const pendingEnemies = squadFromSingleEnemy(spawnVeilStalkerProfile(inc.nodesCleared));
    const pendingEnemy = pendingEnemies[0] ?? null;
    const envModifiers = buildEnvironmentalModifiersForNode(
      encounterNode?.environmentType,
      inc.resonance.percent,
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
  }, [appendRunLog]);

  const prepareHarvestAmbushEncounter = useCallback(() => {
    const inc = activeIncursionRef.current;
    const encounterNode = resolveActiveVectorNode(inc);
    const prev = runStateRef.current;
    const sector = prev.currentSector ?? INITIAL_SECTOR_POOL[0];
    const envModifiers = buildEnvironmentalModifiersForNode(
      encounterNode?.environmentType,
      inc.resonance.percent,
    );
    const district = getDistrictFromDepth(depthFromNodesCleared(inc.nodesCleared));
    const pendingEnemies = spawnCombatSquad({
      nodeIndex: inc.nodesCleared,
      isElite: true,
      isAmbush: true,
      district,
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
    if (encounterNode?.environmentType) {
      appendRunLog(environmentAdvantageLogLine(encounterNode.environmentType));
    }
    if (pendingEnemy.affinity) {
      appendRunLog(affinityCombatLogLine(pendingEnemy.affinity));
    }
    appendRunLog(`>> HOSTILE SIGNATURE: ${pendingEnemy.designation} [${pendingEnemy.class}] HP ${pendingEnemy.maxHp}.`);
  }, [appendRunLog]);

  const advanceIncursionAfterEncounter = useCallback((message: string) => {
    appendRunLog(`>> ${message}`);

    const inc = activeIncursionRef.current;
    const completedNode = inc.encounterPath[inc.nodesCleared] ?? resolveActiveVectorNode(inc);
    const completedIndex = inc.nodesCleared;

    const encounterPath = inc.encounterPath.map((node, index) =>
      index === completedIndex ? { ...node, isCompleted: true } : node,
    );

    narrativeNodeRef.current = null;

    const graphNodes = { ...inc.sectorGraph.nodes };
    if (completedNode && graphNodes[completedNode.id]) {
      graphNodes[completedNode.id] = { ...graphNodes[completedNode.id], isCompleted: true };
    }

    const wasBoss = completedNode?.type === 'BOSS_COMBAT' || completedNode?.isAnomalyNest === true;
    const nextNodesCleared = completedIndex + 1;
    const nextCurrentNodeId =
      completedNode?.id && graphNodes[completedNode.id]
        ? completedNode.id
        : inc.currentNodeId;

    let nextCargo = inc.cargo;
    if (inc.resonance.percent >= RESONANCE_TIER_DATA_BLEED && !nextCargo.dataBleedActive) {
      nextCargo = { ...nextCargo, dataBleedActive: true };
      appendRunLog('>> DATA_BLEED INFECTED — cargo market value erodes each node.');
    }
    if (nextCargo.dataBleedActive) {
      const bleedResult = applyDataBleedToCargo(nextCargo);
      nextCargo = bleedResult.cargo;
      if (bleedResult.drainedValue > 0) {
        appendRunLog(`>> DATA_BLEED — −${bleedResult.drainedValue} cargo value dissolved to ash.`);
      }
    }

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
    const nextPatrolSeed = scanSessionKeyRef.current + 1;

    let nextResonancePercent = inc.resonance.percent;
    let nextEscalations = inc.resonanceEscalations;
    let nextSectorGraph = expandedInc.sectorGraph;
    let nextPatrolState = inc.patrolState;

    if (isCombatVentNode(completedNode?.type)) {
      const vent = computeClearVent();
      const ventPatch = buildResonanceMutationPatch(inc, -vent, nextPatrolSeed);
      ventPatch.escalationLogLines.forEach((line) => appendRunLog(line));
      nextResonancePercent = ventPatch.resonancePercent;
      nextEscalations = ventPatch.resonanceEscalations;
      nextSectorGraph = ventPatch.sectorGraph;
      appendRunLog(`>> RESONANCE -${vent}% — COMBAT VENT`);
    }

    nextPatrolState = resolvePatrolState(nextResonancePercent, nextDistrict, nextPatrolSeed);
    if (nextPatrolState.blipCount > 0 && inc.patrolState.blipCount === 0) {
      appendRunLog(`>> PATROL CONTACT — ${nextPatrolState.blipCount} hostile signal(s) on Ley-Tracker.`);
    }

    const incAfterClear: ActiveIncursionState = {
      ...expandedInc,
      sectorGraph: nextSectorGraph,
      currentNodeId: resolvedNextNodeId,
      nodesCleared: nextNodesCleared,
      currentDepth: nextDepth,
      currentDistrict: nextDistrict,
      currentEncounterIndex: nextNodesCleared,
      encounterPath,
      cargo: nextCargo,
      resonance: { percent: nextResonancePercent },
      resonanceEscalations: nextEscalations,
      patrolState: nextPatrolState,
      bossDefeated: wasBoss || inc.bossDefeated,
      primeExtractionBonus: wasBoss ? true : inc.primeExtractionBonus,
      pendingHarvestReturn: null,
      currentNarrativeId: null,
      activeChoice: null,
      bossProfile: null,
      selectedVectorId: null,
      previewNodeId: null,
      scanConfirmOverlayVisible: false,
      mapMode: 'SCANNING_HUB',
      lastCheckpointMessage: null,
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

    const clearedDepth = depthFromNodesCleared(completedIndex);
    const enteringSafehouse = wasBoss && isDistrictGateDepth(clearedDepth);

    const incWithMode: ActiveIncursionState = enteringSafehouse
      ? { ...incAfterClear, mapMode: 'SAFEHOUSE_INTERMISSION' }
      : incAfterClear;

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

    if (nextNodesCleared >= MAX_SECTOR_NODES && !inc.collapseActive) {
      appendRunLog('>> SECTOR CAP REACHED — MASTER EXTRACTION LINK OR COLLAPSE RIFT ONLY.');
    } else if (inc.collapseActive) {
      appendRunLog(`>> COLLAPSE RIFT NODE ${nextNodesCleared} — RESONANCE UNBOUND.`);
    } else if (!enteringSafehouse) {
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
    const inc = activeIncursionRef.current;
    const wasBlindBreach = !inc.focusedNodeIds.includes(node.id)
      && node.type !== 'SAFE_ANCHOR_EXTRACTION'
      && node.type !== 'MASTER_EXTRACTION_LINK'
      && node.sectorMeta?.isFocused !== true;

    let enteringCollapse = inc.collapseActive;
    if (
      !inc.collapseActive
      && inc.bossDefeated
      && node.type !== 'MASTER_EXTRACTION_LINK'
      && (isCollapseForwardNode(node) || inc.nodesCleared >= MAX_SECTOR_NODES)
    ) {
      enteringCollapse = true;
      appendRunLog('>> POCKET DIMENSION COLLAPSE — resonance telemetry uncapped.');
    }

    let extraResonance = 0;
    if (wasBlindBreach && node.environmentType) {
      const penalty = applyBlindBreachPenalty(
        node.environmentType,
        runStateRef.current.maxSoulAnchor,
      );
      penalty.logLines.forEach((line) => appendRunLog(line));
      extraResonance += penalty.resonanceSpike;
      if (penalty.soulAnchorLoss > 0) {
        setRunState((prev) => {
          const next = {
            ...prev,
            soulAnchorIntegrity: Math.max(0, prev.soulAnchorIntegrity - penalty.soulAnchorLoss),
          };
          runStateRef.current = next;
          return next;
        });
      }
    }

    let nextResonance = inc.resonance.percent;
    let nextSectorGraph = inc.sectorGraph;
    let nextEscalations = inc.resonanceEscalations;
    let nextPatrolState = inc.patrolState;

    if (extraResonance > 0) {
      const alarmPatch = buildResonanceMutationPatch(
        inc,
        extraResonance,
        scanSessionKeyRef.current,
      );
      alarmPatch.escalationLogLines.forEach((line) => appendRunLog(line));
      nextResonance = alarmPatch.resonancePercent;
      nextEscalations = alarmPatch.resonanceEscalations;
      nextSectorGraph = alarmPatch.sectorGraph;
      nextPatrolState = alarmPatch.patrolState;
      appendRunLog(`>> RESONANCE +${extraResonance}% — ENVIRONMENTAL ALARM TRIPPED.`);
      if (alarmPatch.patrolState.blipCount > 0 && inc.patrolState.blipCount === 0) {
        appendRunLog(`>> PATROL CONTACT — ${alarmPatch.patrolState.blipCount} hostile signal(s) on Ley-Tracker.`);
      }
    }

    const encounterPath = [...inc.encounterPath];
    encounterPath[inc.nodesCleared] = {
      ...node,
      index: inc.nodesCleared,
      encounterIndex: inc.nodesCleared,
    };
    if (isTerminalBlindActive(inc.resonanceEscalations)) {
      nextEscalations = {
        ...nextEscalations,
        terminalBlindNodesRemaining: nextEscalations.terminalBlindNodesRemaining - 1,
      };
    }
    if (node.id.startsWith('extraction-decoy-')) {
      nextEscalations = consumeExtractionDecoy(nextEscalations);
    }

    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        encounterPath,
        selectedVectorId: node.id,
        resonance: { percent: nextResonance },
        resonanceEscalations: nextEscalations,
        sectorGraph: nextSectorGraph,
        patrolState: nextPatrolState,
        collapseActive: enteringCollapse || prev.collapseActive,
      };
      activeIncursionRef.current = next;
      return next;
    });

    appendRunLog(
      `>> VECTOR ENGAGED — NODE ${inc.nodesCleared + 1} // ${node.label.split(' // ').slice(1).join(' // ') || node.label}`,
    );

    if (node.type === 'EMERGENCY_EXTRACTION') {
      appendRunLog('>> EMERGENCY EXTRACTION LINK ENGAGED — EVAC CONDUIT OPEN.');
      return node.type;
    }

    if (node.type === 'RESOURCE_HARVEST') {
      beginResourceNodeHarvest();
      setActiveIncursion((prev) => {
        const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
        activeIncursionRef.current = next;
        return next;
      });
      return node.type;
    }

    if (node.type === 'STANDARD_COMBAT' || node.type === 'ELITE_COMBAT') {
      prepareStandardCombatEncounter();
      setActiveIncursion((prev) => {
        const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
        activeIncursionRef.current = next;
        return next;
      });
      return node.type;
    }

    if (node.type === 'NARRATIVE_EVENT') {
      assignNarrativeForCombat(node);
      setActiveIncursion((prev) => {
        const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
        activeIncursionRef.current = next;
        return next;
      });
      return node.type;
    }

    if (node.type === 'SANCTUARY' || node.type === 'BLACK_MARKET') {
      const huntActive = activeIncursionRef.current.resonanceEscalations.veilStalkerHuntActive;
      if (huntActive && Math.random() < VEIL_STALKER_AMBUSH_CHANCE) {
        appendRunLog('>> VEIL STALKER AMBUSH — sanctuary vector compromised.');
        prepareVeilStalkerEncounter();
        setActiveIncursion((prev) => {
          const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
          activeIncursionRef.current = next;
          return next;
        });
        return 'ELITE_COMBAT';
      }
      if (node.type === 'BLACK_MARKET') {
        rollBlackMarketStockForNode();
      }
      setActiveIncursion((prev) => {
        const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
        activeIncursionRef.current = next;
        return next;
      });
      return node.type;
    }

    if (isBossNodeType(node.type)) {
      prepareBossEncounter();
      setActiveIncursion((prev) => {
        const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
        activeIncursionRef.current = next;
        return next;
      });
      return node.type;
    }

    return null;
  }, [
    appendRunLog,
    assignNarrativeForCombat,
    beginResourceNodeHarvest,
    prepareBossEncounter,
    prepareStandardCombatEncounter,
    prepareVeilStalkerEncounter,
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

  const adjustResonance = useCallback((amount: number, reason: string): number => {
    const inc = activeIncursionRef.current;
    const patch = buildResonanceMutationPatch(inc, amount, scanSessionKeyRef.current);
    patch.escalationLogLines.forEach((line) => appendRunLog(line));

    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        resonance: { percent: patch.resonancePercent },
        resonanceEscalations: patch.resonanceEscalations,
        sectorGraph: patch.sectorGraph,
        patrolState: patch.patrolState,
      };
      activeIncursionRef.current = next;
      return next;
    });
    const sign = amount >= 0 ? '+' : '';
    appendRunLog(`>> RESONANCE ${sign}${amount}% — ${reason}`);
    if (patch.patrolState.blipCount > 0 && inc.patrolState.blipCount === 0) {
      appendRunLog(`>> PATROL CONTACT — ${patch.patrolState.blipCount} hostile signal(s) on Ley-Tracker.`);
    }
    return patch.resonancePercent;
  }, [appendRunLog]);

  const applyResonanceManifestScan = useCallback((nodeId: string) => {
    const inc = activeIncursionRef.current;
    if (inc.resonanceManifestNodeIds.includes(nodeId)) return;

    const gain = computeScanPenalty(inc.currentDistrict);
    const patch = buildResonanceMutationPatch(inc, gain, scanSessionKeyRef.current);
    patch.escalationLogLines.forEach((line) => appendRunLog(line));

    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        resonance: { percent: patch.resonancePercent },
        resonanceEscalations: patch.resonanceEscalations,
        sectorGraph: patch.sectorGraph,
        patrolState: patch.patrolState,
        resonanceManifestNodeIds: [...prev.resonanceManifestNodeIds, nodeId],
      };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog(`>> RESONANCE +${gain}% — RIFT MANIFEST SCAN`);
    if (patch.patrolState.blipCount > 0 && inc.patrolState.blipCount === 0) {
      appendRunLog(`>> PATROL CONTACT — ${patch.patrolState.blipCount} hostile signal(s) on Ley-Tracker.`);
    }
    const zone = getResonanceZone(patch.resonancePercent);
    if (zone === 'CRITICAL' && getResonanceZone(inc.resonance.percent) !== 'CRITICAL') {
      appendRunLog('>> CRITICAL HEAT — patrol vectors accelerating.');
    }
  }, [appendRunLog]);

  const getSafehouseIntel = useCallback(() => {
    const inc = activeIncursionRef.current;
    return getUpcomingDistrictIntel(inc.currentDistrict);
  }, []);

  const transferRunCargoToBankVault = useCallback((percent: number) => {
    const inc = activeIncursionRef.current;
    const result = transferRunCargoToBank(
      inc.cargo,
      { totalValue: 0, lastTransferValue: 0 },
      percent,
    );
    if (!result) {
      return { success: false, logLine: '>> PAYLOAD TRANSFER FAILED — NO CARGO TO BANK.' };
    }
    setActiveIncursion((prev) => {
      const next = { ...prev, cargo: result.cargo };
      activeIncursionRef.current = next;
      return next;
    });
    return {
      success: true,
      logLine: `>> PAYLOAD BANKED — ${result.transferredValue} VALUE SECURED TO CABAL VAULT.`,
      transferredValue: result.transferredValue,
    };
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
    setActiveIncursion((prev) => {
      const next = { ...prev, cargo: bench.cargo };
      activeIncursionRef.current = next;
      return next;
    });
    setRunState((prev) => {
      const next = { ...prev, soulAnchorIntegrity: bench.nextHp };
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

    const nextPatrolState = createEmptyPatrolState();
    const next: ActiveIncursionState = {
      ...inc,
      resonance: { percent: 0 },
      patrolState: nextPatrolState,
      mapMode: 'SCANNING_HUB',
      resonanceManifestNodeIds: [],
    };

    activeIncursionRef.current = next;
    setActiveIncursion(next);
    setScanSessionKey((k) => k + 1);
    appendRunLog(`>> UNSEAL DOOR — ENTERING DISTRICT ${next.currentDistrict}.`);
    appendRunLog('>> RESONANCE RESET — DISTRICT HEAT VENTED TO ZERO.');
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
    appendRunLog('>> EMERGENCY RECALL INITIATED — rift defense combat staging.');
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
    appendRunLog('>> DEFEND THE RIFT SECURED — emergency evac review opening.');
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
        const next = { ...prev, cargo: bleedResult.cargo, extractionReviewKind: null };
        activeIncursionRef.current = next;
        return next;
      });
      appendRunLog(`>> EMERGENCY EXTRACT BLEED — −${bleedResult.drainedValue} cargo value purged.`);
    } else {
      setActiveIncursion((prev) => {
        const next = { ...prev, extractionReviewKind: null };
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
      itemId: itemId as IncursionConsumableUseResult['itemId'],
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
      default:
        return null;
    }

    setActiveIncursion((prev) => {
      const next: ActiveIncursionState = {
        ...prev,
        cargo: nextCargo,
      };
      activeIncursionRef.current = next;
      return next;
    });

    return {
      ...result,
      healAmount,
      stunsEnemy,
      logLine,
    };
  }, []);

  const useResonanceBribeFromCargo = useCallback((): boolean => {
    const inc = activeIncursionRef.current;
    if (!hasCargoItem(inc.cargo, 'resonance-bribe')) return false;
    const nextCargo = consumeCargoItem(inc.cargo, 'resonance-bribe');
    if (!nextCargo) return false;
    setActiveIncursion((prev) => {
      const vented = Math.max(0, prev.resonance.percent - 25);
      const next = {
        ...prev,
        cargo: nextCargo,
        resonance: { percent: vented },
      };
      activeIncursionRef.current = next;
      return next;
    });
    appendRunLog('>> RESONANCE BRIBE — local trackers scrambled. −25% resonance.');
    return true;
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
    setRunState((prev) => {
      const next = {
        ...prev,
        soulAnchorIntegrity: Math.min(prev.maxSoulAnchor, prev.soulAnchorIntegrity + amount),
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

  const purchaseBlackMarketCargo = useCallback((itemId: CargoItemId): { success: boolean; logLine: string } | null => {
    const inc = activeIncursionRef.current;
    const stock = inc.blackMarketStock.length > 0 ? inc.blackMarketStock : rollBlackMarketStock();
    const listing = listingsForStock(stock).find((entry) => entry.id === itemId)
      ?? listingsForStock(rollBlackMarketStock()).find((entry) => entry.id === itemId);
    const price = listing?.price ?? CARGO_ITEM_CATALOG[itemId]?.baseValue ?? 60;
    if (stock.length > 0 && !stock.includes(itemId)) {
      return { success: false, logLine: '[REJECTED] >> Item not in current market stock.' };
    }
    if (inc.runCredits < price) {
      return { success: false, logLine: '[REJECTED] >> Insufficient run credits for cargo purchase.' };
    }

    setActiveIncursion((prev) => {
      const nextCargo = addLootToContainment(prev.cargo, itemId, 1);
      const next = {
        ...prev,
        runCredits: prev.runCredits - price,
        cargo: nextCargo,
      };
      activeIncursionRef.current = next;
      return next;
    });

    return {
      success: true,
      logLine: `>> BLACK MARKET CARGO — ${CARGO_ITEM_CATALOG[itemId].name} staged in containment. -${price} RUN CREDITS.`,
    };
  }, []);

  const value = useMemo(
    () => ({
      runState,
      runLog,
      scanSessionKey,
      postCombatMutationChoices,
      appendRunLog,
      startNewRun,
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
      rollBlackMarketStockForNode,
      useResonanceBribeFromCargo,
      useDeadDropTokenFromCargo,
      applySkillCheckTier,
      applyRestChoice,
      getCurrentEncounter,
      getCurrentSkillCheck,
      endRun,
      setPendingAmbush,
      clearPendingAmbush,
      assignNarrativeForCombat,
      getCurrentNarrativeNode,
      resolveNarrativeCheck,
      activeIncursion,
      getCurrentEncounterNode,
      getCurrentVectorCluster,
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
      finishBadgeTestCombat,
      exitCombatToBadge,
      useIncursionConsumable,
      applyIncursionConsumableHeal,
      awardRunCredits,
      setAegisLoadout,
      purchaseBlackMarketCargo,
      focusPreviewNode,
      spendAttunementCharge,
      calculateSectorExtractionPayout,
      placeCargoItem,
      relocateCargoItem,
      applyHarvestChoice,
      useFocusingAmpouleFromCargo,
      beginPostCombatHarvest,
      beginResourceNodeHarvest,
      stageSafeAnchorReview,
      confirmSafeAnchorExtraction,
      continueFromExtractionReview,
      adjustResonance,
      applyResonanceManifestScan,
      transitionToNextDistrict,
      transferRunCargoToBankVault,
      restoreHealthFromBench,
      getSafehouseIntel,
      initiateEmergencyRecall,
      completeDefendRiftVictory,
      confirmMasterExtraction,
      applyEmergencyRecallCargoBleed,
    }),
    [
      runState,
      runLog,
      scanSessionKey,
      postCombatMutationChoices,
      appendRunLog,
      startNewRun,
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
      rollBlackMarketStockForNode,
      useResonanceBribeFromCargo,
      useDeadDropTokenFromCargo,
      applySkillCheckTier,
      applyRestChoice,
      getCurrentEncounter,
      getCurrentSkillCheck,
      endRun,
      setPendingAmbush,
      clearPendingAmbush,
      assignNarrativeForCombat,
      getCurrentNarrativeNode,
      resolveNarrativeCheck,
      activeIncursion,
      getCurrentEncounterNode,
      getCurrentVectorCluster,
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
      finishBadgeTestCombat,
      exitCombatToBadge,
      useIncursionConsumable,
      applyIncursionConsumableHeal,
      awardRunCredits,
      setAegisLoadout,
      purchaseBlackMarketCargo,
      focusPreviewNode,
      spendAttunementCharge,
      calculateSectorExtractionPayout,
      placeCargoItem,
      relocateCargoItem,
      applyHarvestChoice,
      useFocusingAmpouleFromCargo,
      beginPostCombatHarvest,
      beginResourceNodeHarvest,
      stageSafeAnchorReview,
      confirmSafeAnchorExtraction,
      continueFromExtractionReview,
      adjustResonance,
      applyResonanceManifestScan,
      transitionToNextDistrict,
      transferRunCargoToBankVault,
      restoreHealthFromBench,
      getSafehouseIntel,
      initiateEmergencyRecall,
      completeDefendRiftVictory,
      confirmMasterExtraction,
      applyEmergencyRecallCargoBleed,
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
