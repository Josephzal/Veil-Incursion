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
import { createEmptyContractMemory } from '../data/contractProceduralEngine';
import { sanitizePersistedContractBoard } from '../data/economySaveMigrationEngine';
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
  devGenerate20SectorOperations,
  devGenerateSectorOperation,
  formatOperationProceduralReport,
} from '../data/operationProceduralDebugEngine';
import {
  devSimulate20ContractBoards,
  formatContractProceduralReport,
} from '../data/contractProceduralDebugEngine';
import {
  buildAllSectorsForAnchorReport,
  devGenerateAnchorInstance,
  devForceAnchorRotation,
  devPrintSectorAnchorMemory,
  devSimulateAllSectorAnchorRotations,
  devSuppressCurrentAnchor,
  formatAnchorProceduralReport,
} from '../data/anchorProceduralDebugEngine';
import {
  devGenerateRunWorldBriefReport as buildDevRunWorldBriefReport,
  devSimulateAllSectorBriefs,
  devForceCrisisThemeBrief,
  devSimulateRunWorldBriefs,
  formatRunWorldBriefProceduralReport,
} from '../data/runWorldBriefDebugEngine';
import { ensureAllSectorAnchorStates } from '../data/anchorLifecycleEngine';
import {
  createEmptyProceduralWorldMemory,
} from '../types/runWorldBrief';
import { recordBriefInMemory } from '../data/runWorldBriefEngine';
import { recordOperationKindInMemory } from '../data/proceduralDirectorRepeatEngine';
import {
  applyAftermathFromRun,
  buildAftermathDebriefLines,
  expireAllSectorAftermath,
  formatAftermathDebriefStrings,
} from '../data/proceduralDirectorAftermathEngine';
import type { RunAftermathInput } from '../types/proceduralAftermath';
import {
  devExpireAllAftermathReport,
  devProceduralMemoryReport,
  devRunProceduralDirectorReport,
  devSimulateDirectedBriefs,
} from '../data/proceduralDirectorDebugEngine';
import {
  devAftermathValidationReport,
  devSimulate10RunAftermathCycle,
  devSimulateAftermathCreation,
} from '../data/proceduralAftermathDebugEngine';
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
import { normalizeBreachGradeId } from '../data/breachGradeEngine';
import type { BreachGradeId } from '../types/progression';
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
  setSelectedBreachGrade: (grade: BreachGradeId) => void;
  selectContract: (contract: GeneratedContract) => void;
  selectIndependentContract: () => void;
  abandonSelectedContract: () => void;
  buildRunContextForDescent: () => {
    runGenerationContext: RunGenerationContext;
    runModifiers: RunModifierSnapshot;
    runWorldBrief: import('../types/runWorldBrief').RunWorldBrief | null;
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
  devGenerateSectorOperation: () => string;
  devGenerate20Operations: () => string;
  devGetOperationProceduralReport: () => string;
  devGetContractProceduralReport: () => string;
  devSimulate20ContractBoards: () => string;
  devGetAnchorProceduralReport: () => string;
  devGenerateAnchorInstance: () => string;
  devSimulateAnchorRotations: () => string;
  devForceAnchorRotation: () => void;
  devSuppressAnchor: () => void;
  devPrintAnchorMemory: () => string;
  devGetRunWorldBriefReport: () => string;
  devGenerateRunWorldBrief: () => string;
  devSimulateRunWorldBriefs: (count?: number) => string;
  devSimulateAllSectorBriefs: () => string;
  devForceCrisisThemeBrief: (theme: import('../types/runWorldBrief').CrisisTheme) => string;
  devRunProceduralDirectorReport: () => string;
  devSimulateDirectedBriefs: (count?: number) => string;
  devSimulateAftermathCreation: () => string;
  devSimulate10RunAftermathCycle: () => string;
  devAftermathValidationReport: () => string;
  devExpireAllAftermath: () => string;
  devProceduralMemoryReport: () => string;
  applyPostRunAftermath: (input: RunAftermathInput) => string[];
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
  const preSanitizeBoard = {
    ...baseBoard,
    lastUsedSponsorId: baseBoard.lastUsedSponsorId ?? parsed.selectedEmployerCabal ?? null,
  };
  const { board: sanitizedBoard } = sanitizePersistedContractBoard(preSanitizeBoard);
  const contractBoard = { ...sanitizedBoard };
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
    selectedBreachGrade: normalizeBreachGradeId(
      (parsed as { selectedBreachGrade?: unknown }).selectedBreachGrade
        ?? defaults.selectedBreachGrade,
    ),
    contractBoard,
    deployRunIndex,
    operationProgress: { ...defaults.operationProgress, ...parsed.operationProgress },
    activeOperationIndex: { ...defaults.activeOperationIndex, ...parsed.activeOperationIndex },
    temporarySectorModifiers: parsed.temporarySectorModifiers ?? defaults.temporarySectorModifiers,
    dormantAnchorRuns: { ...defaults.dormantAnchorRuns, ...parsed.dormantAnchorRuns },
    sectorOperationLifecycle,
    operationInstances: { ...defaults.operationInstances, ...parsed.operationInstances },
    operationProceduralMemory: {
      ...defaults.operationProceduralMemory,
      ...parsed.operationProceduralMemory,
    },
    contractProceduralMemory: {
      ...createEmptyContractMemory(),
      ...defaults.contractProceduralMemory,
      ...parsed.contractProceduralMemory,
      recentContractKindsBySponsor: {
        ...createEmptyContractMemory().recentContractKindsBySponsor,
        ...defaults.contractProceduralMemory?.recentContractKindsBySponsor,
        ...parsed.contractProceduralMemory?.recentContractKindsBySponsor,
      },
      recentContractTitleHashesBySponsor: {
        ...createEmptyContractMemory().recentContractTitleHashesBySponsor,
        ...defaults.contractProceduralMemory?.recentContractTitleHashesBySponsor,
        ...parsed.contractProceduralMemory?.recentContractTitleHashesBySponsor,
      },
      recentContractResourceIdsBySponsor: {
        ...createEmptyContractMemory().recentContractResourceIdsBySponsor,
        ...defaults.contractProceduralMemory?.recentContractResourceIdsBySponsor,
        ...parsed.contractProceduralMemory?.recentContractResourceIdsBySponsor,
      },
      recentBoardMemoryKeys: parsed.contractProceduralMemory?.recentBoardMemoryKeys
        ?? defaults.contractProceduralMemory?.recentBoardMemoryKeys
        ?? [],
    },
    operationLog: parsed.operationLog ?? defaults.operationLog,
    anchorStateBySector: {
      ...defaults.anchorStateBySector,
      ...parsed.anchorStateBySector,
    },
    proceduralWorldMemory: {
      ...createEmptyProceduralWorldMemory(),
      ...defaults.proceduralWorldMemory,
      ...parsed.proceduralWorldMemory,
    },
    sectorAftermathModifiersBySector: {
      ...defaults.sectorAftermathModifiersBySector,
      ...parsed.sectorAftermathModifiersBySector,
    },
    aftermathMeta: {
      ...defaults.aftermathMeta,
      ...parsed.aftermathMeta,
    },
    version: 2,
  };
  return ensureAllSectorAnchorStates(migrateWorldStateSectorKeys(merged));
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

  const setSelectedBreachGrade = useCallback((grade: BreachGradeId) => {
    setPersisted((prev) => ({
      ...prev,
      selectedBreachGrade: normalizeBreachGradeId(grade),
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
    if (context.runWorldBrief) {
      setPersisted((prev) => ({
        ...prev,
        proceduralWorldMemory: recordOperationKindInMemory(
          recordBriefInMemory(
            {
              ...createEmptyProceduralWorldMemory(),
              ...prev.proceduralWorldMemory,
            },
            context.runWorldBrief!,
          ),
          context.sectorState.id,
          context.activeOperation.objectiveKind,
        ),
      }));
    }
    return {
      runGenerationContext: context,
      runModifiers: runGenerationContextToModifiers(context),
      runWorldBrief: context.runWorldBrief ?? null,
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
      const sectorId = prev.selectedSectorId;
      const afterModifiers = tickTemporarySectorModifiers(prev, sectorId);
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

  const devGenerateSectorOperationReport = useCallback(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return '';
    const result = devGenerateSectorOperation(persisted, selectedSector.id);
    setPersisted(result.persisted);
    setOperationProgress({});
    localProgressRef.current.hydrate({});
    return result.report;
  }, [persisted, selectedSector.id]);

  const devGenerate20OperationsReport = useCallback(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return '';
    return devGenerate20SectorOperations(persisted, selectedSector.id);
  }, [persisted, selectedSector.id]);

  const devGetOperationProceduralReport = useCallback(() => {
    return formatOperationProceduralReport(persisted, sectors);
  }, [persisted, sectors]);

  const devGetContractProceduralReport = useCallback(() => {
    return formatContractProceduralReport(persisted, sectors);
  }, [persisted, sectors]);

  const devSimulate20ContractBoardsReport = useCallback(() => {
    return devSimulate20ContractBoards(persisted, selectedSector.id, selectedSector);
  }, [persisted, selectedSector]);

  const devGetAnchorProceduralReport = useCallback(() => {
    const anchorSectors = buildAllSectorsForAnchorReport(persisted);
    return formatAnchorProceduralReport(persisted, anchorSectors);
  }, [persisted]);

  const devGenerateAnchorInstanceCallback = useCallback(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return '';
    return devGenerateAnchorInstance(persisted, selectedSector.id);
  }, [persisted, selectedSector.id]);

  const devSimulateAnchorRotationsReport = useCallback(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return '';
    return devSimulateAllSectorAnchorRotations(persisted, 10);
  }, [persisted]);

  const devForceAnchorRotationAction = useCallback(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    setPersisted((prev) => devForceAnchorRotation(prev, selectedSector.id));
  }, [selectedSector.id]);

  const devSuppressAnchorAction = useCallback(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    setPersisted((prev) => devSuppressCurrentAnchor(prev, selectedSector.id, 3));
  }, [selectedSector.id]);

  const devPrintAnchorMemoryReport = useCallback(() => {
    return devPrintSectorAnchorMemory(persisted, selectedSector.id);
  }, [persisted, selectedSector.id]);

  const devGetRunWorldBriefReport = useCallback(() => {
    return formatRunWorldBriefProceduralReport(persisted, sectors);
  }, [persisted, sectors]);

  const devGenerateRunWorldBriefCallback = useCallback(() => {
    return buildDevRunWorldBriefReport(persisted, selectedSector.id, operationProgress);
  }, [persisted, selectedSector.id, operationProgress]);

  const devSimulateRunWorldBriefsReport = useCallback((count = 20) => {
    return devSimulateRunWorldBriefs(persisted, selectedSector.id, count);
  }, [persisted, selectedSector.id]);

  const devSimulateAllSectorBriefsReport = useCallback(() => {
    return devSimulateAllSectorBriefs(persisted);
  }, [persisted]);

  const devForceCrisisThemeBriefReport = useCallback((theme: import('../types/runWorldBrief').CrisisTheme) => {
    return devForceCrisisThemeBrief(persisted, selectedSector.id, theme, operationProgress);
  }, [persisted, selectedSector.id, operationProgress]);

  const devRunProceduralDirectorReportCallback = useCallback(() => {
    return devRunProceduralDirectorReport(persisted, selectedSector.id, operationProgress);
  }, [persisted, selectedSector.id, operationProgress]);

  const devSimulateDirectedBriefsReport = useCallback((count = 100) => {
    return devSimulateDirectedBriefs(persisted, selectedSector.id, count);
  }, [persisted, selectedSector.id]);

  const devSimulateAftermathCreationReport = useCallback(() => {
    const result = devSimulateAftermathCreation(persisted, selectedSector.id);
    setPersisted(result.persisted);
    return result.report;
  }, [persisted, selectedSector.id]);

  const devSimulate10RunAftermathCycleReport = useCallback(() => {
    return devSimulate10RunAftermathCycle(persisted, selectedSector.id);
  }, [persisted, selectedSector.id]);

  const devAftermathValidationReportCallback = useCallback(() => {
    return devAftermathValidationReport(persisted);
  }, [persisted]);

  const devExpireAllAftermathCallback = useCallback(() => {
    setPersisted((prev) => expireAllSectorAftermath(prev));
    return devExpireAllAftermathReport(persisted);
  }, [persisted]);

  const devProceduralMemoryReportCallback = useCallback(() => {
    return devProceduralMemoryReport(persisted, sectors);
  }, [persisted, sectors]);

  const applyPostRunAftermath = useCallback((input: RunAftermathInput): string[] => {
    let lines: string[] = [];
    setPersisted((prev) => {
      const { persisted: next, result } = applyAftermathFromRun(prev, input);
      lines = formatAftermathDebriefStrings(buildAftermathDebriefLines(result));
      return next;
    });
    return lines;
  }, []);

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
      setSelectedBreachGrade,
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
      devGenerateSectorOperation: devGenerateSectorOperationReport,
      devGenerate20Operations: devGenerate20OperationsReport,
      devGetOperationProceduralReport,
      devGetContractProceduralReport,
      devSimulate20ContractBoards: devSimulate20ContractBoardsReport,
      devGetAnchorProceduralReport,
      devGenerateAnchorInstance: devGenerateAnchorInstanceCallback,
      devSimulateAnchorRotations: devSimulateAnchorRotationsReport,
      devForceAnchorRotation: devForceAnchorRotationAction,
      devSuppressAnchor: devSuppressAnchorAction,
      devPrintAnchorMemory: devPrintAnchorMemoryReport,
      devGetRunWorldBriefReport,
      devGenerateRunWorldBrief: devGenerateRunWorldBriefCallback,
      devSimulateRunWorldBriefs: devSimulateRunWorldBriefsReport,
      devSimulateAllSectorBriefs: devSimulateAllSectorBriefsReport,
      devForceCrisisThemeBrief: devForceCrisisThemeBriefReport,
      devRunProceduralDirectorReport: devRunProceduralDirectorReportCallback,
      devSimulateDirectedBriefs: devSimulateDirectedBriefsReport,
      devSimulateAftermathCreation: devSimulateAftermathCreationReport,
      devSimulate10RunAftermathCycle: devSimulate10RunAftermathCycleReport,
      devAftermathValidationReport: devAftermathValidationReportCallback,
      devExpireAllAftermath: devExpireAllAftermathCallback,
      devProceduralMemoryReport: devProceduralMemoryReportCallback,
      applyPostRunAftermath,
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
      setSelectedBreachGrade,
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
      devGenerateSectorOperationReport,
      devGenerate20OperationsReport,
      devGetOperationProceduralReport,
      devGetContractProceduralReport,
      devSimulate20ContractBoardsReport,
      devGetAnchorProceduralReport,
      devGenerateAnchorInstanceCallback,
      devSimulateAnchorRotationsReport,
      devForceAnchorRotationAction,
      devSuppressAnchorAction,
      devPrintAnchorMemoryReport,
      devGetRunWorldBriefReport,
      devGenerateRunWorldBriefCallback,
      devSimulateRunWorldBriefsReport,
      devSimulateAllSectorBriefsReport,
      devForceCrisisThemeBriefReport,
      devRunProceduralDirectorReportCallback,
      devSimulateDirectedBriefsReport,
      devSimulateAftermathCreationReport,
      devSimulate10RunAftermathCycleReport,
      devAftermathValidationReportCallback,
      devExpireAllAftermathCallback,
      devProceduralMemoryReportCallback,
      applyPostRunAftermath,
    ],
  );

  return <WorldStateContext.Provider value={value}>{children}</WorldStateContext.Provider>;
}

export function useWorldState() {
  const ctx = useContext(WorldStateContext);
  if (!ctx) throw new Error('useWorldState must be used within WorldStateProvider');
  return ctx;
}
