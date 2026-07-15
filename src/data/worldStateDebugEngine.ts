import type { SectorOperationTemplate } from './sectorWorldCatalog';
import { getSectorWorldTemplate, SECTOR_WORLD_TEMPLATES } from './sectorWorldCatalog';
import {
  buildForcedOperationTemplate,
  resolveAndCacheSectorOperation,
} from './operationGenerator';
import { createSectorOperationLifecycle } from './operationLifecycleEngine';
import { applyOperationCompletion } from './worldStateEngine';
import type {
  OperationObjectiveKind,
  SectorId,
  SectorState,
  WorldStatePersistedState,
} from '../types/worldState';
import { DEFAULT_OPERATION_PROGRESS_REQUIRED } from './worldStateHelpers';
import { generateContractForObjectiveKind } from './contractGenerator';
import {
  ensureSectorAnchorState,
  getActiveAnchorInstance,
  getSectorAnchorState,
  suppressAnchorForSector,
} from './anchorLifecycleEngine';

export function stripDevFieldsForPersistence(
  persisted: WorldStatePersistedState,
): WorldStatePersistedState {
  const { sectorOperationOverrides, ...rest } = persisted;
  return rest;
}

export function devRegenerateAllSectorOperations(
  persisted: WorldStatePersistedState,
): WorldStatePersistedState {
  let next: WorldStatePersistedState = {
    ...persisted,
    sectorOperationOverrides: { ...persisted.sectorOperationOverrides },
    activeOperationIndex: { ...persisted.activeOperationIndex },
    operationProgress: { ...persisted.operationProgress },
    sectorOperationLifecycle: { ...persisted.sectorOperationLifecycle },
    operationInstances: { ...persisted.operationInstances },
    operationProceduralMemory: { ...persisted.operationProceduralMemory },
  };

  SECTOR_WORLD_TEMPLATES.forEach((sector) => {
    const currentIndex = next.activeOperationIndex[sector.id] ?? 0;
    const nextIndex = currentIndex + 1;
    const { template, persisted: withCache } = resolveAndCacheSectorOperation(
      sector.id,
      nextIndex,
      next.deployRunIndex,
      next,
      next.sectorOperationOverrides,
    );
    next = withCache;
    next.activeOperationIndex[sector.id] = nextIndex;
    next.operationProgress[template.id] = 0;
    next.sectorOperationLifecycle[sector.id] = createSectorOperationLifecycle(
      template.id,
      next.deployRunIndex,
    );
    if (next.sectorOperationOverrides?.[sector.id]) {
      const overrides = { ...next.sectorOperationOverrides };
      delete overrides[sector.id];
      next.sectorOperationOverrides = overrides;
    }
  });

  next.operationLog = [
    '>> DEV — REGENERATED OPERATIONS FOR ALL SECTORS.',
    ...next.operationLog,
  ].slice(0, 24);

  return next;
}

export function devForceSectorOperation(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  objectiveKind: OperationObjectiveKind,
): WorldStatePersistedState {
  const nextIndex = (persisted.activeOperationIndex[sectorId] ?? 0) + 1000;
  const template = buildForcedOperationTemplate(
    sectorId,
    objectiveKind,
    nextIndex,
    persisted.deployRunIndex,
    persisted,
  );

  const overrideSnapshot: SectorOperationTemplate = template;

  return {
    ...persisted,
    sectorOperationOverrides: {
      ...persisted.sectorOperationOverrides,
      [sectorId]: overrideSnapshot,
    },
    activeOperationIndex: {
      ...persisted.activeOperationIndex,
      [sectorId]: nextIndex,
    },
    operationProgress: {
      ...persisted.operationProgress,
      [template.id]: 0,
    },
    sectorOperationLifecycle: {
      ...persisted.sectorOperationLifecycle,
      [sectorId]: createSectorOperationLifecycle(template.id, persisted.deployRunIndex),
    },
    operationLog: [
      `>> DEV — FORCED ${objectiveKind} ON ${getSectorWorldTemplate(sectorId).displayName.toUpperCase()}.`,
      ...persisted.operationLog,
    ].slice(0, 24),
  };
}

export function devSetAnchorDormant(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
  runs: number,
): WorldStatePersistedState {
  const { persisted: withState } = ensureSectorAnchorState(persisted, sectorId);
  const instance = getActiveAnchorInstance(withState, sectorId);
  if (!instance) return withState;
  return suppressAnchorForSector(withState, sectorId, instance.id, runs, 'dev-dormant');
}

export function devClearAnchorDormant(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): WorldStatePersistedState {
  const state = getSectorAnchorState(persisted, sectorId);
  if (!state) return persisted;
  const nextDormant = { ...persisted.dormantAnchorRuns };
  state.dormantAnchors.forEach((d: { instanceId: string }) => {
    delete nextDormant[d.instanceId];
  });
  return {
    ...persisted,
    dormantAnchorRuns: nextDormant,
    anchorStateBySector: {
      ...persisted.anchorStateBySector,
      [sectorId]: {
        ...state,
        dormantAnchors: [],
      },
    },
    operationLog: [
      `>> DEV — ANCHOR DORMANCY CLEARED FOR ${getSectorWorldTemplate(sectorId).displayName.toUpperCase()}.`,
      ...persisted.operationLog,
    ].slice(0, 24),
  };
}

export function devForceOperationCompletion(
  persisted: WorldStatePersistedState,
  sector: SectorState,
): { next: WorldStatePersistedState; logLines: string[] } {
  const progressRequired = sector.activeOperation.progressRequired
    ?? DEFAULT_OPERATION_PROGRESS_REQUIRED;
  const operation = {
    ...sector.activeOperation,
    progressCurrent: progressRequired,
  };
  const withProgress: WorldStatePersistedState = {
    ...persisted,
    operationProgress: {
      ...persisted.operationProgress,
      [operation.id]: progressRequired,
    },
  };
  return applyOperationCompletion(withProgress, sector.id, operation);
}

export function formatWorldStateDebugSnapshot(
  persisted: WorldStatePersistedState,
  sectors: SectorState[],
): string {
  const lines = [
    `Deploy run index: ${persisted.deployRunIndex}`,
    `Selected sector: ${persisted.selectedSectorId}`,
    `Cached procedural instances: ${Object.keys(persisted.operationInstances ?? {}).length}`,
    '',
  ];
  sectors.forEach((sector) => {
    const op = sector.activeOperation;
    lines.push(`${sector.displayName} (${sector.id})`);
    lines.push(`  Anchor: ${sector.activeAnchor?.displayName ?? 'DORMANT / NONE'}${sector.activeAnchor?.modifier ? ` (${sector.activeAnchor.modifier})` : ''}`);
    lines.push(`  Operation: ${op.title} [${op.objectiveKind}]${op.procedural ? ' (procedural)' : ''}`);
    lines.push(`  Progress: ${op.progressCurrent}/${op.progressRequired} (${op.lifecycleStatus})`);
    if (op.targetResourceIds?.length) {
      lines.push(`  Targets: ${op.targetResourceIds.join(', ')}`);
    }
    if (op.targetDepths?.length) {
      lines.push(`  Depths: ${op.targetDepths.join(', ')}`);
    }
    if (op.bonusObjectives?.length) {
      lines.push(`  Bonus objectives: ${op.bonusObjectives.length}`);
    }
    if (op.completionEffectSummary) {
      lines.push(`  Completion: ${op.completionEffectSummary}`);
    }
    lines.push(`  Runs: ${op.generatedAtRunIndex} → ${op.expiresAtRunIndex} (${op.runsRemaining} left)`);
    lines.push(`  Reward: ${op.rewardPreview}`);
    lines.push('');
  });
  if (persisted.operationLog.length > 0) {
    lines.push('Recent operation log:');
    persisted.operationLog.slice(0, 6).forEach((line) => lines.push(`  ${line}`));
  }
  return lines.join('\n');
}

export function devForceRoutingTestContract(
  persisted: WorldStatePersistedState,
  kind: 'RECOVER_ECONOMY_INTEL' | 'RECOVER_CONTRABAND',
): WorldStatePersistedState {
  const onBoard = persisted.contractBoard.contracts.find((contract) => contract.objectiveKind === kind);
  const contract = onBoard ?? generateContractForObjectiveKind(kind, persisted.deployRunIndex);
  if (!contract) return persisted;

  const contracts = onBoard
    ? persisted.contractBoard.contracts
    : [contract, ...persisted.contractBoard.contracts].slice(0, 6);

  return {
    ...persisted,
    contractBoard: {
      ...persisted.contractBoard,
      contracts,
      lastUsedSponsorId: contract.sponsorId,
      selectedContract: {
        kind: 'SPONSOR',
        contract,
        selectedAtRunIndex: persisted.deployRunIndex,
      },
    },
    operationLog: [
      `>> DEV — FORCED ROUTING CONTRACT: ${contract.title}`,
      ...persisted.operationLog,
    ].slice(0, 24),
  };
}
