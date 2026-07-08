import type {
  SectorId,
  SectorOperationLifecycle,
  WorldStatePersistedState,
} from '../types/worldState';
import {
  DEFAULT_OPERATION_AFTERMATH_RUNS,
  DEFAULT_OPERATION_MAX_RUNS,
} from './worldStateHelpers';
import { resolveSectorOperationTemplate } from './operationGenerator';
import { getSectorWorldTemplate, SECTOR_WORLD_TEMPLATES } from './sectorWorldCatalog';

function resolveSectorOperationIndex(
  sectorId: SectorId,
  persisted: WorldStatePersistedState,
): number {
  return persisted.activeOperationIndex[sectorId] ?? 0;
}

export function createSectorOperationLifecycle(
  operationId: string,
  maxRunsActive = DEFAULT_OPERATION_MAX_RUNS,
): SectorOperationLifecycle {
  return {
    operationId,
    status: 'ACTIVE',
    runsSinceActivation: 0,
    maxRunsActive,
    aftermathRunsRemaining: 0,
  };
}

export function getSectorOperationLifecycle(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  operationId: string,
): SectorOperationLifecycle {
  const existing = persisted.sectorOperationLifecycle[sectorId];
  if (existing?.operationId === operationId) return existing;
  return createSectorOperationLifecycle(operationId);
}

export function operationRunsRemaining(lifecycle: SectorOperationLifecycle): number {
  if (lifecycle.status === 'AFTERMATH') {
    return lifecycle.aftermathRunsRemaining;
  }
  return Math.max(0, lifecycle.maxRunsActive - lifecycle.runsSinceActivation);
}

export interface OperationRotationResult {
  next: WorldStatePersistedState;
  logLines: string[];
  rotated: boolean;
  nextOperationTitle?: string;
}

function rotateSectorOperation(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  reason: string,
): OperationRotationResult {
  const currentIndex = persisted.activeOperationIndex[sectorId] ?? 0;
  const nextIndex = currentIndex + 1;
  const nextTemplate = resolveSectorOperationTemplate(
    sectorId,
    nextIndex,
    persisted.deployRunIndex,
  );
  const sectorName = getSectorWorldTemplate(sectorId).displayName;

  const nextLifecycle = createSectorOperationLifecycle(nextTemplate.id);
  const logLines = [
    `>> OPERATION ${reason.toUpperCase()} — ${sectorName.toUpperCase()}`,
    `>> NEW OPERATION: ${nextTemplate.title.toUpperCase()}.`,
  ];

  return {
    rotated: true,
    nextOperationTitle: nextTemplate.title,
    logLines,
    next: {
      ...persisted,
      activeOperationIndex: {
        ...persisted.activeOperationIndex,
        [sectorId]: nextIndex,
      },
      operationProgress: {
        ...persisted.operationProgress,
        [nextTemplate.id]: 0,
      },
      sectorOperationLifecycle: {
        ...persisted.sectorOperationLifecycle,
        [sectorId]: nextLifecycle,
      },
      operationLog: [...logLines, ...persisted.operationLog].slice(0, 24),
    },
  };
}

export function tickSectorOperationLifecycleAfterRun(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  operationId: string,
): OperationRotationResult {
  const lifecycle = getSectorOperationLifecycle(persisted, sectorId, operationId);

  if (lifecycle.status === 'AFTERMATH') {
    const aftermathRunsRemaining = lifecycle.aftermathRunsRemaining - 1;
    if (aftermathRunsRemaining <= 0) {
      return rotateSectorOperation(persisted, sectorId, 'aftermath concluded');
    }
    return {
      rotated: false,
      logLines: [],
      next: {
        ...persisted,
        sectorOperationLifecycle: {
          ...persisted.sectorOperationLifecycle,
          [sectorId]: {
            ...lifecycle,
            aftermathRunsRemaining,
          },
        },
      },
    };
  }

  const runsSinceActivation = lifecycle.runsSinceActivation + 1;
  if (runsSinceActivation >= lifecycle.maxRunsActive) {
    return rotateSectorOperation(persisted, sectorId, 'expired');
  }

  return {
    rotated: false,
    logLines: [],
    next: {
      ...persisted,
      sectorOperationLifecycle: {
        ...persisted.sectorOperationLifecycle,
        [sectorId]: {
          ...lifecycle,
          runsSinceActivation,
        },
      },
    },
  };
}

export function beginOperationAftermath(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  operationId: string,
  aftermathRuns = DEFAULT_OPERATION_AFTERMATH_RUNS,
): WorldStatePersistedState {
  const lifecycle = getSectorOperationLifecycle(persisted, sectorId, operationId);
  return {
    ...persisted,
    sectorOperationLifecycle: {
      ...persisted.sectorOperationLifecycle,
      [sectorId]: {
        ...lifecycle,
        status: 'AFTERMATH',
        aftermathRunsRemaining: aftermathRuns,
      },
    },
  };
}

export function tickAllSectorOperationLifecycles(
  persisted: WorldStatePersistedState,
): { next: WorldStatePersistedState; logLines: string[] } {
  let next = persisted;
  const logLines: string[] = [];

  for (const sector of SECTOR_WORLD_TEMPLATES) {
    const operationIndex = resolveSectorOperationIndex(sector.id, next);
    const template = resolveSectorOperationTemplate(
      sector.id,
      operationIndex,
      next.deployRunIndex,
    );
    const result = tickSectorOperationLifecycleAfterRun(next, sector.id, template.id);
    next = result.next;
    logLines.push(...result.logLines);
  }

  return { next, logLines };
}
