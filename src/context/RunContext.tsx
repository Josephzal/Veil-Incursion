import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
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
  syncAfterCombat: (remainingHp: number) => void;
  refillStaminaAfterCombat: () => void;
  applyTrinket: (trinket: Trinket) => void;
  preparePostCombatBoons: () => Trinket[];
  applySkillCheckResult: (hpDelta: number, staminaDelta: number, logLine: string) => void;
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
    homeRegion: null,
    currentSector: null,
    activeTrinkets: [],
    pendingEncounter: null,
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
    const next = { ...createInitialRunState(), runActive: true };
    runStateRef.current = next;
    setRunState(next);
    setScanSessionKey(0);
    setPostCombatBoonChoices([]);
    setRunLog(['>> RUN INITIALIZED — ANOMALY SWEEP AUTHORIZED.']);
  }, []);

  const beginScanSession = useCallback(() => {
    setScanSessionKey((k) => k + 1);
  }, []);

  const applyTrinket = useCallback((trinket: Trinket) => {
    setRunState((prev) => {
      const activeTrinkets = [...prev.activeTrinkets, trinket];
      const mods = aggregateModifiers(activeTrinkets);
      let maxSoulAnchor = prev.maxSoulAnchor;
      let soulAnchorIntegrity = prev.soulAnchorIntegrity;
      let currentStamina = prev.currentStamina;

      if (trinket.maxHpBonus) {
        maxSoulAnchor += trinket.maxHpBonus;
        soulAnchorIntegrity += trinket.maxHpBonus;
      }
      if (trinket.hpRestore) {
        soulAnchorIntegrity = Math.min(soulAnchorIntegrity + trinket.hpRestore, maxSoulAnchor);
      }
      if (trinket.staminaRestore) {
        currentStamina = Math.min(currentStamina + trinket.staminaRestore, prev.maxStamina);
      }

      return {
        ...prev,
        activeTrinkets,
        maxSoulAnchor,
        soulAnchorIntegrity,
        currentStamina,
        ...mods,
      };
    });
    appendRunLog(`>> Trinket acquired: ${trinket.name} — ${trinket.effect}`);
  }, [appendRunLog]);

  const commitRadarDot = useCallback((dot: RadarDot): EncounterNode => {
    const prev = runStateRef.current;
    const nodeIndex = prev.homeRegion === null ? 0 : prev.currentNode;
    const encounter = buildEncounter(nodeIndex, dot.sector, dot.encounterType, dot.label);

    const next: RunState = {
      ...prev,
      homeRegion: prev.homeRegion ?? dot.sector.theme,
      currentSector: dot.sector,
      pendingEncounter: encounter,
    };
    runStateRef.current = next;
    setRunState(next);

    if (prev.homeRegion === null) {
      appendRunLog(`>> Home sector locked: ${dot.sector.name} — ${dot.sector.subsector}.`);
    }
    appendRunLog(`>> ${dot.pingLabel} — incursion vector confirmed.`);
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
    const theme = runState.currentSector?.theme ?? runState.homeRegion ?? 'CITY';
    const pool = getThemedSkillChecks(theme);
    return pool[Math.floor(Math.random() * pool.length)] ?? pool[0];
  }, [runState.currentSector, runState.homeRegion]);

  const advanceNode = useCallback(() => {
    const prev = runStateRef.current;
    const nextCompleted = prev.currentNode + 1;
    const hasNext = nextCompleted < TOTAL_RUN_NODES;
    const nextState: RunState = {
      ...prev,
      currentNode: nextCompleted,
      pendingEncounter: null,
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
    let soulAnchorIntegrity = prev.soulAnchorIntegrity;
    let currentStamina = prev.currentStamina;

    if (trinket.maxHpBonus) {
      maxSoulAnchor += trinket.maxHpBonus;
      soulAnchorIntegrity += trinket.maxHpBonus;
    }
    if (trinket.hpRestore) {
      soulAnchorIntegrity = Math.min(soulAnchorIntegrity + trinket.hpRestore, maxSoulAnchor);
    }
    if (trinket.staminaRestore) {
      currentStamina = Math.min(currentStamina + trinket.staminaRestore, prev.maxStamina);
    }

    const nextState: RunState = {
      ...prev,
      activeTrinkets,
      maxSoulAnchor,
      soulAnchorIntegrity,
      currentStamina,
      currentNode: nodesCleared,
      pendingEncounter: null,
      ...mods,
    };
    runStateRef.current = nextState;
    setRunState(nextState);
    setPostCombatBoonChoices([]);

    appendRunLog(`>> Trinket acquired: ${trinket.name} — ${trinket.effect}`);

    return { route: runComplete ? 'RUN_COMPLETE' : 'SCANNING', nodesCleared };
  }, [appendRunLog]);

  const syncAfterCombat = useCallback((remainingHp: number) => {
    setRunState((prev) => ({
      ...prev,
      soulAnchorIntegrity: Math.min(Math.max(remainingHp, 0), prev.maxSoulAnchor),
    }));
  }, []);

  const refillStaminaAfterCombat = useCallback(() => {
    setRunState((prev) => ({
      ...prev,
      currentStamina: prev.maxStamina,
    }));
    appendRunLog('>> Combat node cleared — stamina reserves fully replenished.');
  }, [appendRunLog]);

  const preparePostCombatBoons = useCallback((): Trinket[] => {
    const boons = pickRandomPostCombatBoons(3);
    setPostCombatBoonChoices(boons);
    return boons;
  }, []);

  const applySkillCheckResult = useCallback((hpDelta: number, staminaDelta: number, logLine: string) => {
    setRunState((prev) => ({
      ...prev,
      soulAnchorIntegrity: Math.min(Math.max(prev.soulAnchorIntegrity + hpDelta, 0), prev.maxSoulAnchor),
      currentStamina: Math.min(Math.max(prev.currentStamina + staminaDelta, 0), prev.maxStamina),
    }));
    appendRunLog(logLine);
  }, [appendRunLog]);

  const applyRestChoice = useCallback((type: 'REST' | 'REPAIR') => {
    setRunState((prev) => {
      if (type === 'REST') {
        const restore = Math.floor(prev.maxStamina * 0.4);
        return { ...prev, currentStamina: Math.min(prev.currentStamina + restore, prev.maxStamina) };
      }
      const restore = Math.floor(prev.maxSoulAnchor * 0.25);
      return { ...prev, soulAnchorIntegrity: Math.min(prev.soulAnchorIntegrity + restore, prev.maxSoulAnchor) };
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
      applySkillCheckResult,
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
      applySkillCheckResult,
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

// Re-export for skill check trinket rewards
export { pickRandomTrinkets, TRINKET_POOL };
