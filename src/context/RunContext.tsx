import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { pickRandomClimateCluster, getClusterDefinition } from '../data/climateClusters';
import { createEasyTestEnemy, createHardTestEnemy, spawnBiomeEnemyProfile, spawnEnemyProfile } from '../data/enemies';
import {
  buildEncounter,
  getThemedSkillChecks,
  INITIAL_SECTOR_POOL,
  pickRandomPostCombatBoons,
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
  SCAN_ENGAGE_STAMINA_COST,
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
import { initializeIncursionPipeline } from '../data/macroStoryPipeline';
import {
  pickMatrixEventForEncounter,
  primeNarrativeEnvironment,
  resolveMatrixNarrativeChoice,
  rollVirtualD20,
} from '../data/narrativeEncounterMatrix';
import {
  BOSS_ENCOUNTER_INDEX,
  createBossProfileForDepth,
  createPlaceholderDepthPath,
  finalizeClusterForScan,
  findVectorInCluster,
  generateDepthEncounterMatrix,
  getBiomeContextLog,
  isBossNodeType,
} from '../data/descentEngine';
import { spawnBossEnemyProfile } from '../data/bossCombat';
import { catalogItemForId, createDefaultIncursionInventory } from '../data/incursionInventory';
import { BLACK_MARKET_ITEM_PRICE } from '../data/blackMarket';
import type { IncursionConsumableId, IncursionConsumableUseResult } from '../types/incursionInventory';

export interface RunStartConfig {
  factionPerks?: FactionModifiers;
  unlockedBiomes?: BiomeType[];
}

interface RunContextType {
  runState: RunState;
  runLog: string[];
  scanSessionKey: number;
  postCombatBoonChoices: Trinket[];
  appendRunLog: (text: string) => void;
  startNewRun: (config?: RunStartConfig) => void;
  beginScanSession: () => void;
  commitRadarDot: (dot: RadarDot) => EncounterNode;
  advanceNode: () => { hasNext: boolean; completedCount: number };
  completeNodeAfterBoon: (trinket: Trinket) => void;
  incrementCombatNodesCleared: () => void;
  syncAfterCombat: (remainingHp: number, remainingStamina: number) => void;
  refillStaminaAfterCombat: () => void;
  applyTrinket: (trinket: Trinket) => void;
  preparePostCombatBoons: () => Trinket[];
  applySkillCheckTier: (tier: 'CRITICAL_SUCCESS' | 'SUCCESS' | 'FAILURE' | 'CRITICAL_DESYNC', logLine: string) => void;
  applyRestChoice: (type: 'REST' | 'REPAIR') => void;
  getCurrentEncounter: () => EncounterNode | null;
  getCurrentSkillCheck: () => SkillCheckEvent | null;
  endRun: (reason: string) => void;
  setPendingAmbush: (value: boolean) => void;
  clearPendingAmbush: () => void;
  assignNarrativeForCombat: (nodeIndex: number) => void;
  getCurrentNarrativeNode: () => NarrativeEventNode | null;
  resolveNarrativeCheck: (choice: 'A' | 'B', status: CheckStatus) => string;
  activeIncursion: ActiveIncursionState;
  getCurrentEncounterNode: () => import('../types/game').IncursionNode | null;
  stageEncounterClear: (message: string) => {
    route: 'NEXT_NODE' | 'DEPTH_ADVANCE' | 'HUB_VICTORY';
    nextDepth?: number;
  };
  continueFromProgressCheckpoint: () => {
    route: 'NEXT_NODE' | 'DEPTH_ADVANCE' | 'HUB_VICTORY';
    nextDepth?: number;
  };
  prepareBossEncounter: () => void;
  prepareStandardCombatEncounter: () => void;
  shiftBossPhase: (phase: number) => void;
  setIncursionMapMode: (mode: IncursionMapMode) => void;
  purgeEncounterState: () => void;
  commitNodeEncounter: (nodeId: string) => import('../types/game').RunNodeType | null;
  getCurrentVectorCluster: () => import('../types/game').IncursionNode[];
  getSelectedVectorNode: () => import('../types/game').IncursionNode | null;
  openScanPreview: (nodeId: string) => void;
  closeScanPreview: () => void;
  confirmScanPreview: () => import('../types/game').RunNodeType | null;
  getPreviewNode: () => import('../types/game').IncursionNode | null;
  startBadgeTestCombat: (preset: 'easy' | 'hard') => void;
  finishBadgeTestCombat: () => void;
  /** Clears run or badge test combat (caller navigates to hub / badge). */
  exitCombatToBadge: () => void;
  useIncursionConsumable: (itemId: IncursionConsumableId) => IncursionConsumableUseResult | null;
  /** Applies consumable heal to run state (non-combat screens). */
  applyIncursionConsumableHeal: (amount: number) => void;
  awardRunCredits: (amount: number, reason: string) => void;
  purchaseBlackMarketItem: (itemId: IncursionConsumableId) => { success: boolean; logLine: string } | null;
}

const RunContext = createContext<RunContextType | undefined>(undefined);

function resolveActiveVectorNode(inc: ActiveIncursionState): IncursionNode | null {
  if (inc.selectedVectorId) {
    const cluster = inc.encounterOptionClusters[inc.currentEncounterIndex] ?? [];
    const found = findVectorInCluster(cluster, inc.selectedVectorId);
    if (found) return found;
  }
  return inc.encounterPath[inc.currentEncounterIndex] ?? null;
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
  const [postCombatBoonChoices, setPostCombatBoonChoices] = useState<Trinket[]>([]);
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
    const pipeline = initializeIncursionPipeline(1);
    const incursion: ActiveIncursionState = {
      ...createDefaultActiveIncursionState(),
      isRunActive: true,
      inventory: createDefaultIncursionInventory(),
      currentDepth: 1,
      currentEncounterIndex: 0,
      progress: pipeline.progress,
      encounterPath: pipeline.encounterPath,
      encounterOptionClusters: pipeline.encounterOptionClusters,
      earlySanctuarySpawned: pipeline.earlySanctuarySpawned,
      selectedVectorId: null,
      previewNodeId: null,
      scanConfirmOverlayVisible: false,
      mapMode: 'SCANNING_HUB',
      lastCheckpointMessage: null,
      runCredits: 0,
    };
    activeIncursionRef.current = incursion;
    setActiveIncursion(incursion);
    narrativeNodeRef.current = null;
    setScanSessionKey(1);
    setPostCombatBoonChoices([]);
    const biomeTag = (config?.unlockedBiomes ?? ['HOSPITAL', 'ALLEYWAYS']).join(', ');
    setRunLog([
      '>> RUN INITIALIZED — VEIL DESCENT ENGINE ONLINE.',
      `>> DEPTH 1 THRESHOLD — 10-ENCOUNTER INCURSION GRID GENERATED.`,
      `>> SCANNING HUB ACTIVE — TACTICAL SWEEP INITIALIZING.`,
      `>> CLIMATE CLUSTER LOCKED: ${clusterDef.name}`,
      `>> AUTHORIZED BIOMES: ${biomeTag}`,
      `>> ${clusterDef.tagline}`,
      ...pipeline.initLogLines,
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
    const pendingEnemy =
      dot.encounterType === 'COMBAT'
        ? spawnEnemyProfile(dot.sector, nodeIndex, prev.pendingAmbush)
        : null;

    const next: RunState = {
      ...prev,
      climateCluster: prev.climateCluster ?? 'URBAN',
      currentSector: dot.sector,
      pendingEncounter: encounter,
      pendingEnemy,
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
    };
    runStateRef.current = nextState;
    setRunState(nextState);
    return { hasNext, completedCount: nextCompleted };
  }, []);

  const completeNodeAfterBoon = useCallback((trinket: Trinket) => {
    applyTrinket(trinket);
    setPostCombatBoonChoices([]);
  }, [applyTrinket]);

  const syncAfterCombat = useCallback((remainingHp: number, remainingStamina: number) => {
    setRunState((prev) => {
      const next = {
        ...prev,
        soulAnchorIntegrity: Math.min(Math.max(remainingHp, 0), prev.maxSoulAnchor),
        currentStamina: Math.min(Math.max(remainingStamina, 0), prev.maxStamina),
        pendingEnemy: null,
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

  const preparePostCombatBoons = useCallback((): Trinket[] => {
    const boons = pickRandomPostCombatBoons(3);
    setPostCombatBoonChoices(boons);
    return boons;
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

  const applyRestChoice = useCallback((type: 'REST' | 'REPAIR') => {
    setRunState((prev) => {
      if (type === 'REST') {
        const restore = Math.floor(prev.maxStamina * 0.4);
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
    appendRunLog(type === 'REST' ? '>> Sanctuary Rest — stamina reserves replenished.' : '>> Anchor Repair — soul anchor integrity restored.');
  }, [appendRunLog]);

  const endRun = useCallback((reason: string) => {
    appendRunLog(`>> RUN TERMINATED — ${reason}`);
    const reset = createInitialRunState();
    runStateRef.current = reset;
    setRunState(reset);
    setPostCombatBoonChoices([]);
    const resetIncursion = createDefaultActiveIncursionState();
    activeIncursionRef.current = resetIncursion;
    setActiveIncursion(resetIncursion);
    narrativeNodeRef.current = null;
  }, [appendRunLog]);

  const startBadgeTestCombat = useCallback((preset: 'easy' | 'hard') => {
    const pendingEnemy = preset === 'easy' ? createEasyTestEnemy() : createHardTestEnemy();
    const next: RunState = {
      ...createInitialRunState(),
      runActive: true,
      maxSoulAnchor: BASE_MAX_SOUL_ANCHOR,
      soulAnchorIntegrity: BASE_MAX_SOUL_ANCHOR,
      maxStamina: BASE_MAX_STAMINA,
      currentStamina: BASE_MAX_STAMINA,
      currentSector: INITIAL_SECTOR_POOL[0],
      pendingEnemy,
      combatTestPreset: preset,
    };
    runStateRef.current = next;
    setRunState(next);
    const resetIncursion = createDefaultActiveIncursionState();
    activeIncursionRef.current = resetIncursion;
    setActiveIncursion(resetIncursion);
    narrativeNodeRef.current = null;
    setPostCombatBoonChoices([]);
    setRunLog([
      '>> BADGE TEST COMBAT — ISOLATED ARENA.',
      `>> HOSTILE: ${pendingEnemy.designation} // ${pendingEnemy.maxHp} HP.`,
      preset === 'easy'
        ? '>> ENEMY PROFILE: STRIKE ONLY.'
        : '>> ENEMY PROFILE: STANDARD ABILITIES (NO WORLD-ENDER).',
    ]);
  }, []);

  const finishBadgeTestCombat = useCallback(() => {
    const reset = createInitialRunState();
    runStateRef.current = reset;
    setRunState(reset);
    setPostCombatBoonChoices([]);
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
      };
      runStateRef.current = next;
      return next;
    });
  }, []);

  const assignNarrativeForCombat = useCallback((nodeIndex: number) => {
    const inc = activeIncursionRef.current;
    const node = pickMatrixEventForEncounter(nodeIndex, inc.progress);
    narrativeNodeRef.current = node;
    const primed = primeNarrativeEnvironment(node);
    const encounterNode = resolveActiveVectorNode(inc);
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
    if (encounterNode?.biome) {
      appendRunLog(`>> ${getBiomeContextLog(encounterNode.biome)}`);
    }
    appendRunLog(`>> NARRATIVE VECTOR LOCKED — ${node.title}.`);
    appendRunLog('>> ENCOUNTER LAYER MOUNTED — FIELD CALIBRATION REQUIRED.');
  }, [appendRunLog]);

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
    );

    setActiveIncursion((prev) => {
      const next: ActiveIncursionState = {
        ...prev,
        progress: result.progress,
        environmentalModifiers: result.environmentalModifiers,
        lastCheckStatus: result.status,
        activeChoice: choice,
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

  const getCurrentVectorCluster = useCallback(() => {
    const inc = activeIncursionRef.current;
    const raw = inc.encounterOptionClusters[inc.currentEncounterIndex] ?? [];
    return finalizeClusterForScan(raw, inc.currentEncounterIndex, inc.encounterPath, inc.currentDepth);
  }, []);

  const getSelectedVectorNode = useCallback(() => {
    const inc = activeIncursionRef.current;
    if (!inc.selectedVectorId) return inc.encounterPath[inc.currentEncounterIndex] ?? null;
    const cluster = finalizeClusterForScan(
      inc.encounterOptionClusters[inc.currentEncounterIndex] ?? [],
      inc.currentEncounterIndex,
      inc.encounterPath,
      inc.currentDepth,
    );
    return findVectorInCluster(cluster, inc.selectedVectorId) ?? inc.encounterPath[inc.currentEncounterIndex] ?? null;
  }, []);

  const openScanPreview = useCallback((nodeId: string) => {
    const inc = activeIncursionRef.current;
    if (inc.mapMode !== 'SCANNING_HUB') return;
    const cluster = finalizeClusterForScan(
      inc.encounterOptionClusters[inc.currentEncounterIndex] ?? [],
      inc.currentEncounterIndex,
      inc.encounterPath,
      inc.currentDepth,
    );
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
    const cluster = finalizeClusterForScan(
      inc.encounterOptionClusters[inc.currentEncounterIndex] ?? [],
      inc.currentEncounterIndex,
      inc.encounterPath,
      inc.currentDepth,
    );
    return findVectorInCluster(cluster, inc.previewNodeId);
  }, []);

  const prepareBossEncounter = useCallback(() => {
    const inc = activeIncursionRef.current;
    const encounterNode = resolveActiveVectorNode(inc);
    if (!encounterNode || !isBossNodeType(encounterNode.type)) return;

    const bossProfile = createBossProfileForDepth(inc.currentDepth);
    const sector = runStateRef.current.currentSector ?? INITIAL_SECTOR_POOL[0];
    const pendingEnemy = spawnBossEnemyProfile(
      bossProfile,
      sector,
      inc.currentEncounterIndex,
    );

    setActiveIncursion((prev) => {
      const next = { ...prev, bossProfile };
      activeIncursionRef.current = next;
      return next;
    });

    setRunState((prev) => {
      const next = {
        ...prev,
        pendingEnemy,
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
    appendRunLog(`>> BOSS SIGNATURE: ${bossProfile.name} // ${bossProfile.maxHp} HP`);
  }, [appendRunLog]);

  const prepareStandardCombatEncounter = useCallback(() => {
    const inc = activeIncursionRef.current;
    const encounterNode = resolveActiveVectorNode(inc);
    if (!encounterNode || encounterNode.type !== 'STANDARD_COMBAT') return;

    const prev = runStateRef.current;
    const sector = prev.currentSector ?? INITIAL_SECTOR_POOL[0];
    const pendingEnemy = spawnBiomeEnemyProfile(
      'CITY_STREETS',
      inc.currentEncounterIndex,
      prev.pendingAmbush,
    );
    const pendingEncounter = buildEncounter(
      inc.currentEncounterIndex,
      sector,
      'COMBAT',
      encounterNode.label,
    );

    setRunState((prevState) => {
      const next = {
        ...prevState,
        currentSector: sector,
        pendingEnemy,
        pendingEncounter,
      };
      runStateRef.current = next;
      return next;
    });

    appendRunLog(`>> ${getBiomeContextLog(encounterNode.biome)}`);
    appendRunLog(`>> HOSTILE SIGNATURE: ${pendingEnemy.designation} [${pendingEnemy.class}] HP ${pendingEnemy.maxHp}.`);
  }, [appendRunLog]);

  const advanceIncursionAfterEncounter = useCallback((message: string) => {
    appendRunLog(`>> ${message}`);

    const inc = activeIncursionRef.current;
    const completedIndex = inc.currentEncounterIndex;
    const encounterPath = inc.encounterPath.map((n) =>
      n.index === completedIndex ? { ...n, isCompleted: true } : n,
    );

    narrativeNodeRef.current = null;

    const incAfterClear: ActiveIncursionState = {
      ...inc,
      encounterPath,
      currentNarrativeId: null,
      activeChoice: null,
      bossProfile: null,
      selectedVectorId: null,
      previewNodeId: null,
      scanConfirmOverlayVisible: false,
    };

    setRunState((prev) => {
      const next = {
        ...prev,
        pendingEncounter: null,
        pendingEnemy: null,
      };
      runStateRef.current = next;
      return next;
    });

    const resetForScan = (base: ActiveIncursionState): ActiveIncursionState => ({
      ...base,
      currentNarrativeId: null,
      activeChoice: null,
      bossProfile: null,
      mapMode: 'SCANNING_HUB',
      lastCheckpointMessage: null,
      previewNodeId: null,
      scanConfirmOverlayVisible: false,
    });

    if (completedIndex >= BOSS_ENCOUNTER_INDEX) {
      if (incAfterClear.currentDepth < 3) {
        const nextDepth = incAfterClear.currentDepth + 1;
        const { encounterOptionClusters, earlySanctuarySpawned } = generateDepthEncounterMatrix(nextDepth);
        const nextInc = resetForScan({
          ...incAfterClear,
          currentDepth: nextDepth,
          currentEncounterIndex: 0,
          encounterPath: createPlaceholderDepthPath(),
          encounterOptionClusters,
          earlySanctuarySpawned,
          selectedVectorId: null,
        });
        activeIncursionRef.current = nextInc;
        setActiveIncursion(nextInc);
        setRunState((prev) => {
          const next = { ...prev, currentNode: 0, pendingEncounter: null, pendingEnemy: null };
          runStateRef.current = next;
          return next;
        });
        setScanSessionKey((k) => k + 1);
        appendRunLog(`>> DEPTH ${nextDepth} UNLOCKED — SCANNING HUB RECALIBRATED.`);
        return { route: 'DEPTH_ADVANCE' as const, nextDepth };
      }

      const nextInc = createDefaultActiveIncursionState();
      activeIncursionRef.current = nextInc;
      setActiveIncursion(nextInc);
      return { route: 'HUB_VICTORY' as const };
    }

    const nextIndex = completedIndex + 1;
    const nextInc = resetForScan({
      ...incAfterClear,
      currentEncounterIndex: nextIndex,
      selectedVectorId: null,
    });
    activeIncursionRef.current = nextInc;
    setActiveIncursion(nextInc);

    setRunState((prev) => {
      const next = {
        ...prev,
        currentNode: nextIndex,
        pendingEncounter: null,
        pendingEnemy: null,
      };
      runStateRef.current = next;
      return next;
    });

    setScanSessionKey((k) => k + 1);
    appendRunLog(`>> ENCOUNTER ${nextIndex + 1}/10 — SCANNING HUB READY FOR VECTOR SELECT.`);
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

  const commitNodeEncounter = useCallback((nodeId: string): import('../types/game').RunNodeType | null => {
    const inc = activeIncursionRef.current;
    if (inc.mapMode !== 'SCANNING_HUB') return null;

    const cluster = finalizeClusterForScan(
      inc.encounterOptionClusters[inc.currentEncounterIndex] ?? [],
      inc.currentEncounterIndex,
      inc.encounterPath,
      inc.currentDepth,
    );
    const node = findVectorInCluster(cluster, nodeId);
    if (!node) return null;

    const encounterPath = [...inc.encounterPath];
    encounterPath[inc.currentEncounterIndex] = {
      ...node,
      index: inc.currentEncounterIndex,
      encounterIndex: inc.currentEncounterIndex,
    };

    setActiveIncursion((prev) => {
      const next = { ...prev, encounterPath, selectedVectorId: nodeId };
      activeIncursionRef.current = next;
      return next;
    });

    appendRunLog(
      `>> INCURSION INITIATED — ENCOUNTER ${inc.currentEncounterIndex + 1}/10 // ${node.label.split(' // ').slice(1).join(' // ') || node.label}`,
    );

    if (node.type === 'STANDARD_COMBAT') {
      prepareStandardCombatEncounter();
      setActiveIncursion((prev) => {
        const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
        activeIncursionRef.current = next;
        return next;
      });
      return node.type;
    }

    if (node.type === 'NARRATIVE_EVENT') {
      assignNarrativeForCombat(node.index);
      setActiveIncursion((prev) => {
        const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
        activeIncursionRef.current = next;
        return next;
      });
      return node.type;
    }

    if (node.type === 'SANCTUARY') {
      setActiveIncursion((prev) => {
        const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
        activeIncursionRef.current = next;
        return next;
      });
      return node.type;
    }

    if (node.type === 'BLACK_MARKET') {
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
  }, [appendRunLog, assignNarrativeForCombat, prepareBossEncounter, prepareStandardCombatEncounter]);

  const confirmScanPreview = useCallback((): import('../types/game').RunNodeType | null => {
    const inc = activeIncursionRef.current;
    if (!inc.previewNodeId) return null;

    if (runStateRef.current.currentStamina < SCAN_ENGAGE_STAMINA_COST) {
      appendRunLog('[REJECTED] >> Insufficient stamina for vector engagement.');
      return null;
    }

    const nodeId = inc.previewNodeId;
    setRunState((prev) => {
      const next = { ...prev, currentStamina: prev.currentStamina - SCAN_ENGAGE_STAMINA_COST };
      runStateRef.current = next;
      return next;
    });
    appendRunLog(`>> VECTOR ENGAGEMENT CONFIRMED — ${SCAN_ENGAGE_STAMINA_COST} STAMINA DEDUCTED.`);

    setActiveIncursion((prev) => {
      const next = { ...prev, previewNodeId: null, scanConfirmOverlayVisible: false };
      activeIncursionRef.current = next;
      return next;
    });

    const incAfterClose = activeIncursionRef.current;
    const cluster = finalizeClusterForScan(
      incAfterClose.encounterOptionClusters[incAfterClose.currentEncounterIndex] ?? [],
      incAfterClose.currentEncounterIndex,
      incAfterClose.encounterPath,
      incAfterClose.currentDepth,
    );
    const node = findVectorInCluster(cluster, nodeId);
    if (!node) return null;

    const encounterPath = [...incAfterClose.encounterPath];
    encounterPath[incAfterClose.currentEncounterIndex] = { ...node, index: incAfterClose.currentEncounterIndex, encounterIndex: incAfterClose.currentEncounterIndex };

    setActiveIncursion((prev) => {
      const next = { ...prev, encounterPath, selectedVectorId: nodeId };
      activeIncursionRef.current = next;
      return next;
    });

    appendRunLog(
      `>> INCURSION INITIATED — DEPTH ${incAfterClose.currentEncounterIndex + 1}/10 // ${node.label.split(' // ').slice(1).join(' // ') || node.label}`,
    );

    if (node.type === 'STANDARD_COMBAT') {
      prepareStandardCombatEncounter();
      setActiveIncursion((prev) => {
        const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
        activeIncursionRef.current = next;
        return next;
      });
      return node.type;
    }

    if (node.type === 'NARRATIVE_EVENT') {
      assignNarrativeForCombat(node.encounterIndex);
      setActiveIncursion((prev) => {
        const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
        activeIncursionRef.current = next;
        return next;
      });
      return node.type;
    }

    if (node.type === 'SANCTUARY') {
      setActiveIncursion((prev) => {
        const next = { ...prev, mapMode: 'NODE_ENGAGED' as IncursionMapMode };
        activeIncursionRef.current = next;
        return next;
      });
      return node.type;
    }

    if (node.type === 'BLACK_MARKET') {
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
  }, [appendRunLog, assignNarrativeForCombat, prepareBossEncounter, prepareStandardCombatEncounter]);

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
    setRunState((prev) => ({ ...prev, pendingAmbush: false }));
  }, []);

  const useIncursionConsumable = useCallback((itemId: IncursionConsumableId): IncursionConsumableUseResult | null => {
    const inc = activeIncursionRef.current;
    const item = inc.inventory.items.find((entry) => entry.id === itemId);
    if (!item || item.quantity <= 0 || item.effect === 'unimplemented') return null;

    const run = runStateRef.current;
    let healAmount = 0;
    let stunsEnemy = false;
    let logLine = '';

    if (item.effect === 'stun') {
      stunsEnemy = true;
      logLine = '>> VEIL SHARD DEPLOYED — Hostile neural lock engaged.';
    } else if (item.effect === 'heal') {
      const healPercent = item.healPercent ?? 0;
      healAmount = Math.floor(run.maxSoulAnchor * (healPercent / 100));
      logLine = `>> SOUL CORE DEPLOYED — +${healPercent}% Soul Anchor integrity restored (+${healAmount} HP).`;
    } else {
      return null;
    }

    setActiveIncursion((prev) => {
      const next: ActiveIncursionState = {
        ...prev,
        inventory: {
          items: prev.inventory.items
            .map((entry) => (
              entry.id === itemId
                ? { ...entry, quantity: entry.quantity - 1 }
                : entry
            ))
            .filter((entry) => entry.quantity > 0),
        },
      };
      activeIncursionRef.current = next;
      return next;
    });

    return { itemId, healAmount, stunsEnemy, logLine };
  }, []);

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

  const purchaseBlackMarketItem = useCallback((itemId: IncursionConsumableId): { success: boolean; logLine: string } | null => {
    const inc = activeIncursionRef.current;
    if (inc.runCredits < BLACK_MARKET_ITEM_PRICE) {
      return { success: false, logLine: '[REJECTED] >> Insufficient run credits for black market purchase.' };
    }

    const template = catalogItemForId(itemId);
    const existing = inc.inventory.items.find((entry) => entry.id === itemId);

    setActiveIncursion((prev) => {
      const nextItems = existing
        ? prev.inventory.items.map((entry) => (
          entry.id === itemId
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry
        ))
        : [...prev.inventory.items, { ...template, quantity: 1 }];

      const next: ActiveIncursionState = {
        ...prev,
        runCredits: prev.runCredits - BLACK_MARKET_ITEM_PRICE,
        inventory: { items: nextItems },
      };
      activeIncursionRef.current = next;
      return next;
    });

    return {
      success: true,
      logLine: `>> BLACK MARKET — ${template.name} acquired. -${BLACK_MARKET_ITEM_PRICE} RUN CREDITS.`,
    };
  }, []);

  const value = useMemo(
    () => ({
      runState,
      runLog,
      scanSessionKey,
      postCombatBoonChoices,
      appendRunLog,
      startNewRun,
      beginScanSession,
      commitRadarDot,
      advanceNode,
      completeNodeAfterBoon,
      incrementCombatNodesCleared,
      syncAfterCombat,
      refillStaminaAfterCombat,
      applyTrinket,
      preparePostCombatBoons,
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
      getSelectedVectorNode,
      openScanPreview,
      closeScanPreview,
      confirmScanPreview,
      getPreviewNode,
      stageEncounterClear,
      continueFromProgressCheckpoint,
      prepareBossEncounter,
      prepareStandardCombatEncounter,
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
      purchaseBlackMarketItem,
    }),
    [
      runState,
      runLog,
      scanSessionKey,
      postCombatBoonChoices,
      appendRunLog,
      startNewRun,
      beginScanSession,
      commitRadarDot,
      advanceNode,
      completeNodeAfterBoon,
      incrementCombatNodesCleared,
      syncAfterCombat,
      refillStaminaAfterCombat,
      applyTrinket,
      preparePostCombatBoons,
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
      getSelectedVectorNode,
      openScanPreview,
      closeScanPreview,
      confirmScanPreview,
      getPreviewNode,
      stageEncounterClear,
      continueFromProgressCheckpoint,
      prepareBossEncounter,
      prepareStandardCombatEncounter,
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
      purchaseBlackMarketItem,
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
