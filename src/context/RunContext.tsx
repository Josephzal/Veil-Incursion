import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

interface RunContextType {
  runState: RunState;
  runLog: string[];
  scanSessionKey: number;
  postCombatBoonChoices: Trinket[];
  appendRunLog: (text: string) => void;
  startNewRun: () => void;
  beginScanSession: () => void;
  commitRadarDot: (dot: RadarDot) => EncounterNode;
  advanceNode: () => { hasNext: boolean; completedCount: number };
  completeNodeAfterBoon: (trinket: Trinket) => { route: 'SCANNING' | 'RUN_COMPLETE'; nodesCleared: number };
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
}

const RunContext = createContext<RunContextType | undefined>(undefined);

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

  useEffect(() => {
    runStateRef.current = runState;
  }, [runState]);

  const appendRunLog = useCallback((text: string) => {
    setRunLog((prev) => [...prev, text]);
  }, []);

  const startNewRun = useCallback(() => {
    const cluster = pickRandomClimateCluster();
    const clusterDef = getClusterDefinition(cluster);
    const next: RunState = {
      ...createInitialRunState(),
      runActive: true,
      climateCluster: cluster,
    };
    runStateRef.current = next;
    setRunState(next);
    setScanSessionKey(0);
    setPostCombatBoonChoices([]);
    setRunLog([
      '>> RUN INITIALIZED — ANOMALY SWEEP AUTHORIZED.',
      `>> CLIMATE CLUSTER LOCKED: ${clusterDef.name}`,
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
    const nodeIndex = prev.currentNode;
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
    return runState.pendingEncounter;
  }, [runState.pendingEncounter]);

  const getCurrentSkillCheck = useCallback((): SkillCheckEvent | null => {
    const theme = runState.currentSector?.theme ?? 'CITY';
    const pool = getThemedSkillChecks(theme);
    return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
  }, [runState.currentSector]);

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

  const completeNodeAfterBoon = useCallback((trinket: Trinket): { route: 'SCANNING' | 'RUN_COMPLETE'; nodesCleared: number } => {
    const prev = runStateRef.current;
    const nodesCleared = prev.currentNode + 1;
    const runComplete = nodesCleared >= TOTAL_RUN_NODES;

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

    const nextState: RunState = {
      ...prev,
      activeTrinkets,
      maxSoulAnchor,
      maxStamina,
      soulAnchorIntegrity,
      currentStamina,
      currentNode: nodesCleared,
      pendingEncounter: null,
      pendingEnemy: null,
      ...mods,
    };
    runStateRef.current = nextState;
    setRunState(nextState);
    setPostCombatBoonChoices([]);

    appendRunLog(`>> Trinket acquired: ${trinket.name} — ${trinket.effect}`);

    return { route: runComplete ? 'RUN_COMPLETE' : 'SCANNING', nodesCleared };
  }, [appendRunLog]);

  const syncAfterCombat = useCallback((remainingHp: number, remainingStamina: number) => {
    setRunState((prev) => {
      const next = {
        ...prev,
        soulAnchorIntegrity: Math.min(Math.max(remainingHp, 0), prev.maxSoulAnchor),
        currentStamina: Math.min(Math.max(remainingStamina, 0), prev.maxStamina),
        pendingEnemy: null,
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
  }, [appendRunLog]);

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
