import type { SectorOperationTemplate } from './sectorWorldCatalog';
import { getSectorWorldTemplate, SECTOR_WORLD_TEMPLATES } from './sectorWorldCatalog';
import {
  buildForcedOperationTemplate,
  resolveSectorOperationTemplate,
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
  };

  SECTOR_WORLD_TEMPLATES.forEach((sector) => {
    const currentIndex = next.activeOperationIndex[sector.id] ?? 0;
    const nextIndex = currentIndex + 1;
    const template = resolveSectorOperationTemplate(
      sector.id,
      nextIndex,
      next.deployRunIndex,
      next.sectorOperationOverrides,
    );
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
  );

  return {
    ...persisted,
    sectorOperationOverrides: {
      ...persisted.sectorOperationOverrides,
      [sectorId]: template,
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
  const template = getSectorWorldTemplate(sectorId);
  if (!template.anchor) return persisted;
  const anchorId = `anchor-${sectorId.toLowerCase()}-${template.anchor.type.toLowerCase()}`;
  return {
    ...persisted,
    dormantAnchorRuns: {
      ...persisted.dormantAnchorRuns,
      [anchorId]: runs,
    },
    operationLog: [
      `>> DEV — ${template.anchor.displayName.toUpperCase()} DORMANT FOR ${runs} RUN(S).`,
      ...persisted.operationLog,
    ].slice(0, 24),
  };
}

export function devClearAnchorDormant(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): WorldStatePersistedState {
  const template = getSectorWorldTemplate(sectorId);
  if (!template.anchor) return persisted;
  const anchorId = `anchor-${sectorId.toLowerCase()}-${template.anchor.type.toLowerCase()}`;
  const nextDormant = { ...persisted.dormantAnchorRuns };
  delete nextDormant[anchorId];
  return {
    ...persisted,
    dormantAnchorRuns: nextDormant,
    operationLog: [
      `>> DEV — ${template.anchor.displayName.toUpperCase()} REACTIVATED.`,
      ...persisted.operationLog,
    ].slice(0, 24),
  };
}

export function devForceOperationCompletion(
  persisted: WorldStatePersistedState,
  sector: SectorState,
): { next: WorldStatePersistedState; logLines: string[] } {
  const operation = {
    ...sector.activeOperation,
    progressCurrent: DEFAULT_OPERATION_PROGRESS_REQUIRED,
  };
  const withProgress: WorldStatePersistedState = {
    ...persisted,
    operationProgress: {
      ...persisted.operationProgress,
      [operation.id]: DEFAULT_OPERATION_PROGRESS_REQUIRED,
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
    '',
  ];
  sectors.forEach((sector) => {
    const op = sector.activeOperation;
    lines.push(`${sector.displayName} (${sector.id})`);
    lines.push(`  Anchor: ${sector.activeAnchor?.displayName ?? 'DORMANT / NONE'}`);
    lines.push(`  Operation: ${op.title} [${op.objectiveKind}]`);
    lines.push(`  Progress: ${op.progressCurrent}/${op.progressRequired} (${op.lifecycleStatus})`);
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
