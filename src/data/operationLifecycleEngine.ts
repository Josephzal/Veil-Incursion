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
  deployRunIndex: number,
  maxRunsActive = DEFAULT_OPERATION_MAX_RUNS,
): SectorOperationLifecycle {
  return {
    operationId,
    status: 'ACTIVE',
    runsSinceActivation: 0,
    maxRunsActive,
    aftermathRunsRemaining: 0,
    generatedAtRunIndex: deployRunIndex,
    expiresAtRunIndex: deployRunIndex + maxRunsActive,
  };
}

export function normalizeSectorOperationLifecycle(
  lifecycle: SectorOperationLifecycle,
  deployRunIndex: number,
): SectorOperationLifecycle {
  if (lifecycle.generatedAtRunIndex != null && lifecycle.expiresAtRunIndex != null) {
    return lifecycle;
  }
  const maxRuns = lifecycle.maxRunsActive ?? DEFAULT_OPERATION_MAX_RUNS;
  const runsLeft = Math.max(0, maxRuns - lifecycle.runsSinceActivation);
  return {
    ...lifecycle,
    generatedAtRunIndex: lifecycle.generatedAtRunIndex ?? deployRunIndex,
    expiresAtRunIndex: lifecycle.expiresAtRunIndex ?? deployRunIndex + runsLeft,
  };
}

export function getSectorOperationLifecycle(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  operationId: string,
): SectorOperationLifecycle {
  const existing = persisted.sectorOperationLifecycle[sectorId];
  if (existing?.operationId === operationId) {
    return normalizeSectorOperationLifecycle(existing, persisted.deployRunIndex);
  }
  return createSectorOperationLifecycle(operationId, persisted.deployRunIndex);
}

export function operationRunsRemaining(lifecycle: SectorOperationLifecycle): number {
  if (lifecycle.status === 'COMPLETED') {
    return 0;
  }
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

function clearSectorOperationOverride(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): WorldStatePersistedState['sectorOperationOverrides'] {
  if (!persisted.sectorOperationOverrides?.[sectorId]) {
    return persisted.sectorOperationOverrides;
  }
  const next = { ...persisted.sectorOperationOverrides };
  delete next[sectorId];
  return next;
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
    persisted.sectorOperationOverrides,
  );
  const sectorName = getSectorWorldTemplate(sectorId).displayName;

  const nextLifecycle = createSectorOperationLifecycle(
    nextTemplate.id,
    persisted.deployRunIndex,
  );
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
      sectorOperationOverrides: clearSectorOperationOverride(persisted, sectorId),
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
  const sectorName = getSectorWorldTemplate(sectorId).displayName;

  if (lifecycle.status === 'COMPLETED') {
    const logLines = [
      `>> OPERATION AFTERMATH — ${sectorName.toUpperCase()} // COMMUNITY PROGRESS LOCKED.`,
    ];
    return {
      rotated: false,
      logLines,
      next: {
        ...persisted,
        sectorOperationLifecycle: {
          ...persisted.sectorOperationLifecycle,
          [sectorId]: {
            ...lifecycle,
            status: 'AFTERMATH',
            aftermathRunsRemaining: DEFAULT_OPERATION_AFTERMATH_RUNS,
          },
        },
        operationLog: [...logLines, ...persisted.operationLog].slice(0, 24),
      },
    };
  }

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

/** Marks an operation complete — transitions to AFTERMATH on the next lifecycle tick. */
export function beginOperationCompleted(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  operationId: string,
): WorldStatePersistedState {
  const lifecycle = getSectorOperationLifecycle(persisted, sectorId, operationId);
  return {
    ...persisted,
    sectorOperationLifecycle: {
      ...persisted.sectorOperationLifecycle,
      [sectorId]: {
        ...lifecycle,
        status: 'COMPLETED',
        completedAtRunIndex: persisted.deployRunIndex,
        aftermathRunsRemaining: 0,
      },
    },
  };
}

/** @deprecated Use beginOperationCompleted */
export function beginOperationAftermath(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  operationId: string,
  _aftermathRuns = DEFAULT_OPERATION_AFTERMATH_RUNS,
): WorldStatePersistedState {
  return beginOperationCompleted(persisted, sectorId, operationId);
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
      next.sectorOperationOverrides,
    );
    const result = tickSectorOperationLifecycleAfterRun(next, sector.id, template.id);
    next = result.next;
    logLines.push(...result.logLines);
  }

  return { next, logLines };
}
