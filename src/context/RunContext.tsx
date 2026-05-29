import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildEncounter,
  generatePathChoices,
  getThemedSkillChecks,
  pickRandomPostCombatBoons,
  pickRandomTrinkets,
  TRINKET_POOL,
} from '../data/regions';
import {
  BASE_MAX_SOUL_ANCHOR,
  BASE_MAX_STAMINA,
  EncounterNode,
  PathChoice,
  RunState,
  SectorDefinition,
  SkillCheckEvent,
  Trinket,
  TOTAL_RUN_NODES,
} from '../types/run';

interface RunContextType {
  runState: RunState;
  runLog: string[];
  pathChoices: PathChoice[];
  postCombatBoonChoices: Trinket[];
  appendRunLog: (text: string) => void;
  startNewRun: () => void;
  selectHomeSector: (sector: SectorDefinition) => EncounterNode;
  generatePathDeck: (upcomingNodeIndex: number, combatNodesCleared: number) => PathChoice[];
  selectPathChoice: (choice: PathChoice) => EncounterNode;
  advanceNode: () => { hasNext: boolean; completedCount: number };
  completeNodeAfterBoon: (trinket: Trinket) => { route: 'PATH_CHOICE' | 'RUN_COMPLETE'; nodesCleared: number };
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
  const [pathChoices, setPathChoices] = useState<PathChoice[]>([]);
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
    setPathChoices([]);
    setPostCombatBoonChoices([]);
    setRunLog(['>> RUN INITIALIZED — ANOMALY SWEEP AUTHORIZED.']);
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

  const selectHomeSector = useCallback((sector: SectorDefinition): EncounterNode => {
    const encounter = buildEncounter(0, sector, 'COMBAT', 'Hostile Apparition');
    setRunState((prev) => {
      const next = {
        ...prev,
        homeRegion: sector.theme,
        currentSector: sector,
        pendingEncounter: encounter,
      };
      runStateRef.current = next;
      return next;
    });
    appendRunLog(`>> Home sector locked: ${sector.name} — ${sector.subsector}.`);
    appendRunLog('>> Entering Node 1 — incursion initiated.');
    return encounter;
  }, [appendRunLog]);

  const generatePathDeck = useCallback((upcomingNodeIndex: number, combatNodesCleared: number): PathChoice[] => {
    const homeRegion = runStateRef.current.homeRegion;
    if (!homeRegion) return [];
    const choices = generatePathChoices(homeRegion, upcomingNodeIndex, combatNodesCleared, 3);
    setPathChoices(choices);
    return choices;
  }, []);

  const incrementCombatNodesCleared = useCallback(() => {
    setRunState((prev) => {
      const next = { ...prev, combatNodesCleared: prev.combatNodesCleared + 1 };
      runStateRef.current = next;
      return next;
    });
  }, []);

  const selectPathChoice = useCallback((choice: PathChoice): EncounterNode => {
    let encounter: EncounterNode | null = null;
    setRunState((prev) => {
      const nodeIndex = prev.currentNode;
      encounter = buildEncounter(nodeIndex, choice.sector, choice.encounterType, choice.label);
      return {
        ...prev,
        currentSector: choice.sector,
        pendingEncounter: encounter,
      };
    });
    appendRunLog(`>> Path selected: ${choice.sector.subsector} — ${choice.encounterType}.`);
    return encounter!;
  }, [appendRunLog]);

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

  const completeNodeAfterBoon = useCallback((trinket: Trinket): { route: 'PATH_CHOICE' | 'RUN_COMPLETE'; nodesCleared: number } => {
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

    if (!runComplete && prev.homeRegion) {
      const choices = generatePathChoices(prev.homeRegion, nodesCleared, prev.combatNodesCleared, 3);
      setPathChoices(choices);
    }

    return { route: runComplete ? 'RUN_COMPLETE' : 'PATH_CHOICE', nodesCleared };
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
    setPathChoices([]);
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
      pathChoices,
      postCombatBoonChoices,
      appendRunLog,
      startNewRun,
      selectHomeSector,
      generatePathDeck,
      selectPathChoice,
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
      pathChoices,
      postCombatBoonChoices,
      appendRunLog,
      startNewRun,
      selectHomeSector,
      generatePathDeck,
      selectPathChoice,
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
