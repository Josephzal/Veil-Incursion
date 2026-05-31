import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { pickRandomClimateCluster, getClusterDefinition } from '../data/climateClusters';
import { spawnEnemyProfile } from '../data/enemies';
import {
  buildEncounter,
  getThemedSkillChecks,
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
import {
  narrativeOutcomeLogLine,
  pickNarrativeForNode,
  primeNarrativeEnvironment,
  resolveNarrativeOutcome,
} from '../data/narrativeEvents';
import {
  createBossProfileForTier,
  createPlaceholderTierPath,
  findVectorInCluster,
  generateTierVectorMatrix,
  isBossNodeType,
} from '../data/descentEngine';
import { spawnBossEnemyProfile } from '../data/bossCombat';
import { INITIAL_SECTOR_POOL } from '../data/regions';

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
  getCurrentTierNode: () => import('../types/game').IncursionNode | null;
  stageEncounterClear: (message: string) => { route: 'CHECKPOINT' };
  continueFromProgressCheckpoint: () => {
    route: 'NEXT_NODE' | 'TIER_ADVANCE' | 'HUB_VICTORY';
    nextTier?: number;
  };
  prepareBossEncounter: () => void;
  prepareStandardCombatEncounter: () => void;
  shiftBossPhase: (phase: number) => void;
  setIncursionMapMode: (mode: IncursionMapMode) => void;
  purgeEncounterState: () => void;
  commitNodeEncounter: (nodeId: string) => import('../types/game').RunNodeType | null;
  getCurrentVectorCluster: () => import('../types/game').IncursionNode[];
  getSelectedVectorNode: () => import('../types/game').IncursionNode | null;
}

const RunContext = createContext<RunContextType | undefined>(undefined);

function resolveActiveVectorNode(inc: ActiveIncursionState): IncursionNode | null {
  if (inc.selectedVectorId) {
    const cluster = inc.activeTierVectors[inc.currentNodeIndex] ?? [];
    const found = findVectorInCluster(cluster, inc.selectedVectorId);
    if (found) return found;
  }
  return inc.tierNodes[inc.currentNodeIndex] ?? null;
}

function aggregateModifiers(trinkets: Trinket[]) {
  return trinkets.reduce(
    (acc, t) => ({
      parryWindowBonus: acc.parryWindowBonus + (t.parryWindowBonus ?? 0),
      parryMultiplierBonus: acc.parryMultiplierBonus + (t.parryMultiplierBonus ?? 0),
      sliceDamagePenalty: acc.sliceDamagePenalty + (t.sliceDamagePenalty ?? 0),
      startingKineticPercent: Math.max(acc.startingKineticPercent, t.startingKineticPercent ?? 0),
    }),
    { parryWindowBonus: 0, parryMultiplierBonus: 0, sliceDamagePenalty: 0, startingKineticPercent: 0 },
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
    startingKineticPercent: 0,
    combatNodesCleared: 0,
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
    const next: RunState = {
      ...createInitialRunState(),
      runActive: true,
      climateCluster: cluster,
      maxSoulAnchor,
      soulAnchorIntegrity: maxSoulAnchor,
      maxStamina,
      currentStamina: maxStamina,
    };
    runStateRef.current = next;
    setRunState(next);
    const { activeTierVectors, earlySanctuarySpawned } = generateTierVectorMatrix(1);
    const incursion: ActiveIncursionState = {
      ...createDefaultActiveIncursionState(),
      isRunActive: true,
      currentTier: 1,
      currentNodeIndex: 0,
      tierNodes: createPlaceholderTierPath(),
      activeTierVectors,
      earlySanctuarySpawned,
      selectedVectorId: null,
      mapMode: 'SCANNING_HUB',
      lastCheckpointMessage: null,
    };
    activeIncursionRef.current = incursion;
    setActiveIncursion(incursion);
    narrativeNodeRef.current = null;
    setScanSessionKey(1);
    setPostCombatBoonChoices([]);
    const biomeTag = (config?.unlockedBiomes ?? ['HOSPITAL', 'ALLEYWAYS']).join(', ');
    setRunLog([
      '>> RUN INITIALIZED — VEIL DESCENT ENGINE ONLINE.',
      `>> TIER 1 THRESHOLD — 7-NODE CHAIN GENERATED.`,
      `>> SCANNING HUB ACTIVE — TACTICAL SWEEP INITIALIZING.`,
      `>> CLIMATE CLUSTER LOCKED: ${clusterDef.name}`,
      `>> AUTHORIZED BIOMES: ${biomeTag}`,
      `>> ${clusterDef.tagline}`,
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
    const nodeIndex = activeIncursionRef.current.currentNodeIndex;
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
    const node = pickNarrativeForNode(nodeIndex);
    narrativeNodeRef.current = node;
    const primed = primeNarrativeEnvironment(node);
    setActiveIncursion((prev) => {
      const next = {
        ...prev,
        currentNarrativeId: node.id,
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
    appendRunLog(`>> NARRATIVE NODE LOADED: ${node.title}`);
  }, [appendRunLog]);

  const getCurrentNarrativeNode = useCallback((): NarrativeEventNode | null => {
    return narrativeNodeRef.current;
  }, []);

  const resolveNarrativeCheck = useCallback((choice: 'A' | 'B', status: CheckStatus): string => {
    const node = narrativeNodeRef.current;
    if (!node) return '>> NARRATIVE RESOLVED — NO ACTIVE NODE.';

    setActiveIncursion((prev) => {
      const environmentalModifiers = resolveNarrativeOutcome(
        node,
        choice,
        status,
        prev.environmentalModifiers,
      );
      const next: ActiveIncursionState = {
        ...prev,
        environmentalModifiers,
        lastCheckStatus: status,
        activeChoice: choice,
      };
      activeIncursionRef.current = next;
      return next;
    });

    return narrativeOutcomeLogLine(node, choice, status);
  }, []);

  const getCurrentTierNode = useCallback(() => {
    const inc = activeIncursionRef.current;
    return inc.tierNodes[inc.currentNodeIndex] ?? null;
  }, []);

  const getCurrentVectorCluster = useCallback(() => {
    const inc = activeIncursionRef.current;
    return inc.activeTierVectors[inc.currentNodeIndex] ?? [];
  }, []);

  const getSelectedVectorNode = useCallback(() => {
    const inc = activeIncursionRef.current;
    if (!inc.selectedVectorId) return inc.tierNodes[inc.currentNodeIndex] ?? null;
    const cluster = inc.activeTierVectors[inc.currentNodeIndex] ?? [];
    return findVectorInCluster(cluster, inc.selectedVectorId) ?? inc.tierNodes[inc.currentNodeIndex] ?? null;
  }, []);

  const prepareBossEncounter = useCallback(() => {
    const inc = activeIncursionRef.current;
    const tierNode = resolveActiveVectorNode(inc);
    if (!tierNode || !isBossNodeType(tierNode.type)) return;

    const bossProfile = createBossProfileForTier(inc.currentTier);
    const sector = runStateRef.current.currentSector ?? INITIAL_SECTOR_POOL[0];
    const pendingEnemy = spawnBossEnemyProfile(
      bossProfile,
      sector,
      inc.currentNodeIndex,
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
          inc.currentNodeIndex,
          sector,
          'COMBAT',
          tierNode.label,
        ),
      };
      runStateRef.current = next;
      return next;
    });

    appendRunLog(`>> BOSS SIGNATURE: ${bossProfile.name} // ${bossProfile.maxHp} HP`);
  }, [appendRunLog]);

  const prepareStandardCombatEncounter = useCallback(() => {
    const inc = activeIncursionRef.current;
    const tierNode = resolveActiveVectorNode(inc);
    if (!tierNode || tierNode.type !== 'STANDARD_COMBAT') return;

    const prev = runStateRef.current;
    const sector = prev.currentSector ?? INITIAL_SECTOR_POOL[0];
    const pendingEnemy = spawnEnemyProfile(sector, inc.currentNodeIndex, prev.pendingAmbush);
    const pendingEncounter = buildEncounter(
      inc.currentNodeIndex,
      sector,
      'COMBAT',
      tierNode.label,
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

    appendRunLog(`>> HOSTILE SIGNATURE: ${pendingEnemy.designation} [${pendingEnemy.class}] HP ${pendingEnemy.maxHp}.`);
  }, [appendRunLog]);

  const stageEncounterClear = useCallback((message: string) => {
    appendRunLog(`>> ${message}`);

    const inc = activeIncursionRef.current;
    const completedIndex = inc.currentNodeIndex;
    const tierNodes = inc.tierNodes.map((n) =>
      n.index === completedIndex ? { ...n, isCompleted: true } : n,
    );

    narrativeNodeRef.current = null;

    const nextInc: ActiveIncursionState = {
      ...inc,
      tierNodes,
      currentNarrativeId: null,
      activeChoice: null,
      bossProfile: null,
      mapMode: 'PROGRESS_CHECKPOINT',
      lastCheckpointMessage: message,
      selectedVectorId: null,
    };
    activeIncursionRef.current = nextInc;
    setActiveIncursion(nextInc);

    setRunState((prev) => {
      const next = {
        ...prev,
        pendingEncounter: null,
        pendingEnemy: null,
      };
      runStateRef.current = next;
      return next;
    });

    appendRunLog('>> SECTOR CHECKPOINT — OPERATIVE PERFORMANCE LOG UPDATED.');
    return { route: 'CHECKPOINT' as const };
  }, [appendRunLog]);

  const continueFromProgressCheckpoint = useCallback(() => {
    const inc = activeIncursionRef.current;
    const completedIndex = inc.currentNodeIndex;

    const resetForScan = (base: ActiveIncursionState): ActiveIncursionState => ({
      ...base,
      currentNarrativeId: null,
      activeChoice: null,
      bossProfile: null,
      mapMode: 'SCANNING_HUB',
      lastCheckpointMessage: null,
    });

    if (completedIndex >= 6) {
      if (inc.currentTier < 3) {
        const nextTier = inc.currentTier + 1;
        const { activeTierVectors, earlySanctuarySpawned } = generateTierVectorMatrix(nextTier);
        const nextInc = resetForScan({
          ...inc,
          currentTier: nextTier,
          currentNodeIndex: 0,
          tierNodes: createPlaceholderTierPath(),
          activeTierVectors,
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
        appendRunLog(`>> TIER ${nextTier} DEPTH UNLOCKED — SCANNING HUB RECALIBRATED.`);
        return { route: 'TIER_ADVANCE' as const, nextTier };
      }

      const nextInc = createDefaultActiveIncursionState();
      activeIncursionRef.current = nextInc;
      setActiveIncursion(nextInc);
      return { route: 'HUB_VICTORY' as const };
    }

    const nextIndex = completedIndex + 1;
    const nextInc = resetForScan({
      ...inc,
      currentNodeIndex: nextIndex,
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
    appendRunLog(`>> DEPTH ${nextIndex + 1}/7 — SCANNING HUB READY FOR VECTOR SELECT.`);
    return { route: 'NEXT_NODE' as const };
  }, [appendRunLog]);

  const commitNodeEncounter = useCallback((nodeId: string): import('../types/game').RunNodeType | null => {
    const inc = activeIncursionRef.current;
    if (inc.mapMode !== 'SCANNING_HUB') return null;

    const cluster = inc.activeTierVectors[inc.currentNodeIndex] ?? [];
    const node = findVectorInCluster(cluster, nodeId);
    if (!node) return null;

    const tierNodes = [...inc.tierNodes];
    tierNodes[inc.currentNodeIndex] = { ...node, index: inc.currentNodeIndex };

    setActiveIncursion((prev) => {
      const next = { ...prev, tierNodes, selectedVectorId: nodeId };
      activeIncursionRef.current = next;
      return next;
    });

    appendRunLog(`>> VECTOR COMMITTED — SCAN ${inc.currentNodeIndex + 1}/7: ${node.label}`);

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
      getCurrentTierNode,
      getCurrentVectorCluster,
      getSelectedVectorNode,
      stageEncounterClear,
      continueFromProgressCheckpoint,
      prepareBossEncounter,
      prepareStandardCombatEncounter,
      shiftBossPhase,
      setIncursionMapMode,
      purgeEncounterState,
      commitNodeEncounter,
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
      getCurrentTierNode,
      getCurrentVectorCluster,
      getSelectedVectorNode,
      stageEncounterClear,
      continueFromProgressCheckpoint,
      prepareBossEncounter,
      prepareStandardCombatEncounter,
      shiftBossPhase,
      setIncursionMapMode,
      purgeEncounterState,
      commitNodeEncounter,
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
