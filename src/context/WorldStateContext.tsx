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
  resolveSectorOperationIndex,
  runGenerationContextToModifiers,
  tickTemporarySectorModifiers,
} from '../data/worldStateEngine';
import { getNextSectorOperationTemplate, getSectorWorldTemplate } from '../data/sectorWorldCatalog';
import {
  LocalOperationProgressProvider,
  SimulatedGlobalOperationProgressProvider,
} from '../data/operationProgressProvider';
import { DEFAULT_OPERATION_PROGRESS_REQUIRED } from '../data/worldStateHelpers';
import { migrateWorldStateSectorKeys, normalizeSectorId } from '../data/sectorBiomeBridge';
import type {
  CabalEmployerId,
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
  setSelectedEmployerCabal: (employer: CabalEmployerId | null) => void;
  buildRunContextForDescent: () => {
    runGenerationContext: RunGenerationContext;
    runModifiers: RunModifierSnapshot;
  };
  applyOperationContribution: (
    operationId: string,
    amount: number,
  ) => Promise<OperationContributionResult>;
  tickAfterRunComplete: () => void;
}

const WorldStateContext = createContext<WorldStateContextType | undefined>(undefined);

function mergePersistedState(parsed: Partial<WorldStatePersistedState>): WorldStatePersistedState {
  const defaults = createDefaultWorldState();
  const merged: WorldStatePersistedState = {
    ...defaults,
    ...parsed,
    selectedSectorId: normalizeSectorId(parsed.selectedSectorId ?? defaults.selectedSectorId),
    operationProgress: { ...defaults.operationProgress, ...parsed.operationProgress },
    activeOperationIndex: { ...defaults.activeOperationIndex, ...parsed.activeOperationIndex },
    temporarySectorModifiers: parsed.temporarySectorModifiers ?? defaults.temporarySectorModifiers,
    dormantAnchorRuns: { ...defaults.dormantAnchorRuns, ...parsed.dormantAnchorRuns },
    operationLog: parsed.operationLog ?? defaults.operationLog,
    version: 1,
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
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(persisted)).catch(() => {});
  }, [persisted, isHydrated]);

  const sectors = useMemo(
    () => buildAllSectorStates(persisted, operationProgress),
    [persisted, operationProgress],
  );

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
    setPersisted((prev) => {
      const template = getSectorWorldTemplate(sectorId);
      const employerValid = prev.selectedEmployerCabal == null
        || template.employerPresence.includes(prev.selectedEmployerCabal);
      return {
        ...prev,
        selectedSectorId: sectorId,
        selectedEmployerCabal: employerValid ? prev.selectedEmployerCabal : null,
      };
    });
  }, []);

  const setSelectedEmployerCabal = useCallback((employer: CabalEmployerId | null) => {
    setPersisted((prev) => ({ ...prev, selectedEmployerCabal: employer }));
  }, []);

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
          const currentIndex = resolveSectorOperationIndex(sector.id, prev);
          nextOperationTitle = getNextSectorOperationTemplate(sector.id, currentIndex).title;
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
    setPersisted((prev) => tickTemporarySectorModifiers(prev));
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
      setSelectedEmployerCabal,
      buildRunContextForDescent,
      applyOperationContribution,
      tickAfterRunComplete,
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
      setSelectedEmployerCabal,
      buildRunContextForDescent,
      applyOperationContribution,
      clearPendingDebrief,
      tickAfterRunComplete,
    ],
  );

  return <WorldStateContext.Provider value={value}>{children}</WorldStateContext.Provider>;
}

export function useWorldState() {
  const ctx = useContext(WorldStateContext);
  if (!ctx) throw new Error('useWorldState must be used within WorldStateProvider');
  return ctx;
}
