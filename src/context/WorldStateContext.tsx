import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  applyOperationCompletion,
  buildAllSectorStates,
  buildRunGenerationContext,
  createDefaultWorldState,
  getHubBlackMarketDiscount,
  refreshContractBoardAfterRun,
  runGenerationContextToModifiers,
  tickTemporarySectorModifiers,
} from '../data/worldStateEngine';
import { tickAllSectorOperationLifecycles, normalizeSectorOperationLifecycle } from '../data/operationLifecycleEngine';
import { generateContractBoard } from '../data/contractGenerator';
import {
  devClearAnchorDormant,
  devForceOperationCompletion as devForceOperationCompletionState,
  devForceRoutingTestContract as devForceRoutingTestContractState,
  devForceSectorOperation,
  devRegenerateAllSectorOperations,
  devSetAnchorDormant,
  formatWorldStateDebugSnapshot,
  stripDevFieldsForPersistence,
} from '../data/worldStateDebugEngine';
import {
  logWorldStateValidationWarnings,
} from '../data/worldStateValidation';
import {
  formatFullIntegrationValidationReport,
  logRunIntegrationValidationWarnings,
} from '../data/runIntegration/runLoopValidationEngine';
import {
  LocalOperationProgressProvider,
  SimulatedGlobalOperationProgressProvider,
} from '../data/operationProgressProvider';
import { DEFAULT_OPERATION_PROGRESS_REQUIRED } from '../data/worldStateHelpers';
import { migrateWorldStateSectorKeys, normalizeSectorId } from '../data/sectorBiomeBridge';
import type {
  GeneratedContract,
  SelectedContractState,
} from '../types/contract';
import {
  createIndependentSelectedContract,
} from '../types/contract';
import type {
  CabalEmployerId,
  OperationObjectiveKind,
  RunGenerationContext,
  RunModifierSnapshot,
  SectorId,
  SectorState,
  WorldStatePersistedState,
} from '../types/worldState';
import type { OperationDebriefPayload } from '../data/runDebriefEngine';

const STORAGE_KEY = '@veil_incursion/world_state_v1';

export interface OperationContributionResult {
  completed: boolean;
  logLines: string[];
  operationTitle: string;
  progressBefore: number;
  progressAfter: number;
  progressRequired: number;
  nextOperationTitle?: string;
}

interface WorldStateContextType {
  persisted: WorldStatePersistedState;
  sectors: SectorState[];
  isHydrated: boolean;
  selectedSector: SectorState;
  runGenerationContext: RunGenerationContext;
  hubRunModifiers: RunModifierSnapshot;
  hubBlackMarketDiscountPct: number;
  pendingDebrief: OperationDebriefPayload | null;
  setPendingDebrief: (payload: OperationDebriefPayload | null) => void;
  clearPendingDebrief: () => void;
  setSelectedSectorId: (sectorId: SectorId) => void;
  selectContract: (contract: GeneratedContract) => void;
  selectIndependentContract: () => void;
  abandonSelectedContract: () => void;
  buildRunContextForDescent: () => {
    runGenerationContext: RunGenerationContext;
    runModifiers: RunModifierSnapshot;
  };
  applyOperationContribution: (
    operationId: string,
    amount: number,
  ) => Promise<OperationContributionResult>;
  tickAfterRunComplete: () => void;
  devRegenerateAllOperations: () => void;
  devForceSectorOperation: (sectorId: SectorId, objectiveKind: OperationObjectiveKind) => void;
  devSimulateContribution: (amount: number) => Promise<OperationContributionResult>;
  devForceOperationCompletion: (sectorId?: SectorId) => void;
  devSetAnchorDormant: (sectorId: SectorId, runs: number) => void;
  devClearAnchorDormant: (sectorId: SectorId) => void;
  devForceRoutingTestContract: (kind: 'RECOVER_ECONOMY_INTEL' | 'RECOVER_CONTRABAND') => void;
  devGetValidationReport: () => string;
  devGetDebugSnapshot: () => string;
}

const WorldStateContext = createContext<WorldStateContextType | undefined>(undefined);

function mergePersistedState(parsed: Partial<WorldStatePersistedState> & { selectedEmployerCabal?: CabalEmployerId | null }): WorldStatePersistedState {
  const defaults = createDefaultWorldState();
  const deployRunIndex = parsed.deployRunIndex ?? defaults.deployRunIndex;
  const baseBoard = parsed.contractBoard ?? {
    contracts: generateContractBoard(deployRunIndex),
    selectedContract: createIndependentSelectedContract(),
    boardRefreshRunIndex: deployRunIndex,
    lastUsedSponsorId: null,
  };
  const contractBoard = {
    ...baseBoard,
    lastUsedSponsorId: baseBoard.lastUsedSponsorId ?? parsed.selectedEmployerCabal ?? null,
  };
  if (!contractBoard.contracts || contractBoard.contracts.length === 0) {
    contractBoard.contracts = generateContractBoard(deployRunIndex);
  }

  const sectorOperationLifecycle = Object.fromEntries(
    Object.entries({
      ...defaults.sectorOperationLifecycle,
      ...parsed.sectorOperationLifecycle,
    }).map(([sectorId, lifecycle]) => [
      sectorId,
      normalizeSectorOperationLifecycle(lifecycle, deployRunIndex),
    ]),
  ) as WorldStatePersistedState['sectorOperationLifecycle'];

  const merged: WorldStatePersistedState = {
    ...defaults,
    ...parsed,
    selectedSectorId: normalizeSectorId(parsed.selectedSectorId ?? defaults.selectedSectorId),
    contractBoard,
    deployRunIndex,
    operationProgress: { ...defaults.operationProgress, ...parsed.operationProgress },
    activeOperationIndex: { ...defaults.activeOperationIndex, ...parsed.activeOperationIndex },
    temporarySectorModifiers: parsed.temporarySectorModifiers ?? defaults.temporarySectorModifiers,
    dormantAnchorRuns: { ...defaults.dormantAnchorRuns, ...parsed.dormantAnchorRuns },
    sectorOperationLifecycle,
    operationLog: parsed.operationLog ?? defaults.operationLog,
    version: 2,
  };
  return migrateWorldStateSectorKeys(merged);
}

export function WorldStateProvider({ children }: { children: React.ReactNode }) {
  const [persisted, setPersisted] = useState<WorldStatePersistedState>(createDefaultWorldState());
  const [operationProgress, setOperationProgress] = useState<Record<string, number>>({});
  const [pendingDebrief, setPendingDebrief] = useState<OperationDebriefPayload | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const localProgressRef = useRef(new LocalOperationProgressProvider());
  const progressProviderRef = useRef(
    new SimulatedGlobalOperationProgressProvider(localProgressRef.current),
  );

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!mounted) return;
        if (raw) {
          try {
            const merged = mergePersistedState(JSON.parse(raw));
            setPersisted(merged);
            localProgressRef.current.hydrate(merged.operationProgress);
            setOperationProgress({ ...merged.operationProgress });
          } catch {
            setPersisted(createDefaultWorldState());
          }
        }
        setIsHydrated(true);
      })
      .catch(() => {
        if (mounted) setIsHydrated(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stripDevFieldsForPersistence(persisted))).catch(() => {});
  }, [persisted, isHydrated]);

  const sectors = useMemo(
    () => buildAllSectorStates(persisted, operationProgress),
    [persisted, operationProgress],
  );

  useEffect(() => {
    if (!isHydrated) return;
    logWorldStateValidationWarnings(persisted, sectors);
    logRunIntegrationValidationWarnings(persisted, sectors);
  }, [isHydrated, persisted, sectors]);

  const selectedSector = useMemo(
    () => sectors.find((s) => s.id === persisted.selectedSectorId) ?? sectors[0],
    [sectors, persisted.selectedSectorId],
  );

  const runGenerationContext = useMemo(
    () => buildRunGenerationContext(persisted, operationProgress),
    [persisted, operationProgress],
  );

  const hubRunModifiers = useMemo(
    () => runGenerationContextToModifiers(runGenerationContext),
    [runGenerationContext],
  );

  const hubBlackMarketDiscountPct = useMemo(
    () => getHubBlackMarketDiscount(persisted, operationProgress),
    [persisted, operationProgress],
  );

  const setSelectedSectorId = useCallback((sectorId: SectorId) => {
    setPersisted((prev) => ({
      ...prev,
      selectedSectorId: sectorId,
    }));
  }, []);

  const selectContract = useCallback((contract: GeneratedContract) => {
    setPersisted((prev) => ({
      ...prev,
      contractBoard: {
        ...prev.contractBoard,
        lastUsedSponsorId: contract.sponsorId,
        selectedContract: {
          kind: 'SPONSOR',
          contract,
          selectedAtRunIndex: prev.deployRunIndex,
        } satisfies SelectedContractState,
      },
    }));
  }, []);

  const selectIndependentContract = useCallback(() => {
    setPersisted((prev) => ({
      ...prev,
      contractBoard: {
        ...prev.contractBoard,
        selectedContract: createIndependentSelectedContract(),
      },
    }));
  }, []);

  const abandonSelectedContract = useCallback(() => {
    selectIndependentContract();
  }, [selectIndependentContract]);

  const buildRunContextForDescent = useCallback(() => {
    const context = buildRunGenerationContext(persisted, operationProgress);
    return {
      runGenerationContext: context,
      runModifiers: runGenerationContextToModifiers(context),
    };
  }, [persisted, operationProgress]);

  const applyOperationContribution = useCallback(
    async (operationId: string, amount: number): Promise<OperationContributionResult> => {
      const sector = sectors.find((s) => s.activeOperation.id === operationId);
      const operation = sector?.activeOperation;
      const progressBefore = operation?.progressCurrent ?? 0;
      const progressRequired = operation?.progressRequired ?? DEFAULT_OPERATION_PROGRESS_REQUIRED;

      const nextProgress = await progressProviderRef.current.applyContribution(operationId, amount);
      localProgressRef.current.hydrate({
        ...localProgressRef.current.snapshot(),
        [operationId]: nextProgress,
      });
      setOperationProgress({ ...localProgressRef.current.snapshot() });

      const completed = operation != null && nextProgress >= operation.progressRequired;

      let logLines: string[] = [
        `>> OPERATION CONTRIBUTION — +${amount} → ${operation?.title.toUpperCase() ?? operationId} (${Math.min(100, Math.round((nextProgress / progressRequired) * 100))}%)`,
      ];
      let nextOperationTitle: string | undefined;

      setPersisted((prev) => {
        let next = {
          ...prev,
          operationProgress: {
            ...prev.operationProgress,
            [operationId]: nextProgress,
          },
        };

        if (completed && operation && sector) {
          const resolved = applyOperationCompletion(prev, sector.id, {
            ...operation,
            progressCurrent: nextProgress,
          });
          next = resolved.next;
          logLines = [...logLines, ...resolved.logLines];
        }

        return next;
      });

      return {
        completed,
        logLines,
        operationTitle: operation?.title ?? operationId,
        progressBefore,
        progressAfter: completed ? progressRequired : nextProgress,
        progressRequired,
        nextOperationTitle,
      };
    },
    [sectors],
  );

  const clearPendingDebrief = useCallback(() => {
    setPendingDebrief(null);
  }, []);

  const tickAfterRunComplete = useCallback(() => {
    setPersisted((prev) => {
      const afterModifiers = tickTemporarySectorModifiers(prev);
      const { next: afterLifecycle } = tickAllSectorOperationLifecycles(afterModifiers);
      return refreshContractBoardAfterRun(afterLifecycle);
    });
  }, []);

  const devRegenerateAllOperations = useCallback(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    setPersisted((prev) => devRegenerateAllSectorOperations(prev));
    setOperationProgress({});
    localProgressRef.current.hydrate({});
  }, []);

  const devForceSectorOperationType = useCallback((
    sectorId: SectorId,
    objectiveKind: OperationObjectiveKind,
  ) => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    setPersisted((prev) => devForceSectorOperation(prev, sectorId, objectiveKind));
    setOperationProgress({});
    localProgressRef.current.hydrate({});
  }, []);

  const devSimulateContribution = useCallback((amount: number) => {
    const operationId = selectedSector.activeOperation.id;
    return applyOperationContribution(operationId, amount);
  }, [applyOperationContribution, selectedSector.activeOperation.id]);

  const devForceOperationCompletion = useCallback((sectorId?: SectorId) => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    const target = sectors.find((s) => s.id === (sectorId ?? persisted.selectedSectorId));
    if (!target) return;
    const { next } = devForceOperationCompletionState(persisted, target);
    setPersisted(next);
    setOperationProgress({ ...next.operationProgress });
    localProgressRef.current.hydrate({ ...next.operationProgress });
  }, [persisted, sectors]);

  const devSetAnchorDormantRuns = useCallback((sectorId: SectorId, runs: number) => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    setPersisted((prev) => devSetAnchorDormant(prev, sectorId, runs));
  }, []);

  const devClearAnchorDormantRuns = useCallback((sectorId: SectorId) => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    setPersisted((prev) => devClearAnchorDormant(prev, sectorId));
  }, []);

  const devForceRoutingTestContract = useCallback((
    kind: 'RECOVER_ECONOMY_INTEL' | 'RECOVER_CONTRABAND',
  ) => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    setPersisted((prev) => devForceRoutingTestContractState(prev, kind));
  }, []);

  const devGetValidationReport = useCallback(() => {
    return formatFullIntegrationValidationReport(persisted, sectors);
  }, [persisted, sectors]);

  const devGetDebugSnapshot = useCallback(() => {
    return formatWorldStateDebugSnapshot(persisted, sectors);
  }, [persisted, sectors]);

  const value = useMemo(
    () => ({
      persisted,
      sectors,
      isHydrated,
      selectedSector,
      runGenerationContext,
      hubRunModifiers,
      hubBlackMarketDiscountPct,
      pendingDebrief,
      setPendingDebrief,
      clearPendingDebrief,
      setSelectedSectorId,
      selectContract,
      selectIndependentContract,
      abandonSelectedContract,
      buildRunContextForDescent,
      applyOperationContribution,
      tickAfterRunComplete,
      devRegenerateAllOperations,
      devForceSectorOperation: devForceSectorOperationType,
      devSimulateContribution,
      devForceOperationCompletion,
      devSetAnchorDormant: devSetAnchorDormantRuns,
      devClearAnchorDormant: devClearAnchorDormantRuns,
      devForceRoutingTestContract,
      devGetValidationReport,
      devGetDebugSnapshot,
    }),
    [
      persisted,
      sectors,
      isHydrated,
      selectedSector,
      runGenerationContext,
      hubRunModifiers,
      hubBlackMarketDiscountPct,
      pendingDebrief,
      setSelectedSectorId,
      selectContract,
      selectIndependentContract,
      abandonSelectedContract,
      buildRunContextForDescent,
      applyOperationContribution,
      clearPendingDebrief,
      tickAfterRunComplete,
      devRegenerateAllOperations,
      devForceSectorOperationType,
      devSimulateContribution,
      devForceOperationCompletion,
      devSetAnchorDormantRuns,
      devClearAnchorDormantRuns,
      devForceRoutingTestContract,
      devGetValidationReport,
      devGetDebugSnapshot,
    ],
  );

  return <WorldStateContext.Provider value={value}>{children}</WorldStateContext.Provider>;
}

export function useWorldState() {
  const ctx = useContext(WorldStateContext);
  if (!ctx) throw new Error('useWorldState must be used within WorldStateProvider');
  return ctx;
}
