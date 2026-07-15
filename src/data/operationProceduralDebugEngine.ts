import { SECTOR_WORLD_TEMPLATES } from './sectorWorldCatalog';
import {
  buildOperationGenerationContext,
  generateProceduralOperationV2,
} from './operationProceduralEngine';
import { resolveAndCacheSectorOperation } from './operationGenerator';
import { validateActiveOperations, formatOperationValidationReport } from './operationValidationEngine';
import type { SectorId, SectorState, WorldStatePersistedState } from '../types/worldState';

export function devGenerateSectorOperation(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): { persisted: WorldStatePersistedState; report: string } {
  const nextIndex = (persisted.activeOperationIndex[sectorId] ?? 0) + 1;
  const { template, persisted: withCache } = resolveAndCacheSectorOperation(
    sectorId,
    nextIndex,
    persisted.deployRunIndex,
    persisted,
    persisted.sectorOperationOverrides,
  );

  const lines = [
    `GENERATED OPERATION — ${sectorId}`,
    `ID: ${template.id}`,
    `Kind: ${template.objectiveKind}`,
    `Title: ${template.title}`,
    `Progress: ${template.progressRequired ?? '?'}`,
    `Targets: ${template.targetResourceIds?.join(', ') ?? 'none'}`,
    `Depths: ${template.targetDepths?.join(', ') ?? 'any'}`,
    `Bonus: ${template.bonusObjectives?.length ?? 0}`,
    `Completion: ${template.completionEffectSummary ?? 'n/a'}`,
  ];

  return {
    persisted: {
      ...withCache,
      activeOperationIndex: {
        ...withCache.activeOperationIndex,
        [sectorId]: nextIndex,
      },
      operationProgress: {
        ...withCache.operationProgress,
        [template.id]: 0,
      },
      operationLog: [
        `>> DEV — GENERATED ${template.title.toUpperCase()} ON ${sectorId}.`,
        ...withCache.operationLog,
      ].slice(0, 24),
    },
    report: lines.join('\n'),
  };
}

export function devGenerate20SectorOperations(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): string {
  const titles = new Set<string>();
  const kinds = new Map<string, number>();
  const progressValues: number[] = [];
  const lines: string[] = [`GENERATE 20 OPS — ${sectorId}`, ''];

  for (let i = 0; i < 20; i += 1) {
    const ctx = buildOperationGenerationContext(
      sectorId,
      (persisted.activeOperationIndex[sectorId] ?? 0) + 100 + i,
      persisted.deployRunIndex + i,
    );
    const template = generateProceduralOperationV2(ctx);
    titles.add(template.title);
    kinds.set(template.objectiveKind, (kinds.get(template.objectiveKind) ?? 0) + 1);
    if (template.progressRequired) progressValues.push(template.progressRequired);
    lines.push(`${i + 1}. [${template.objectiveKind}] ${template.title} (${template.progressRequired})`);
  }

  lines.push('');
  lines.push(`Unique titles: ${titles.size}/20`);
  lines.push(`Kinds: ${[...kinds.entries()].map(([k, n]) => `${k}=${n}`).join(', ')}`);
  if (progressValues.length > 0) {
    const min = Math.min(...progressValues);
    const max = Math.max(...progressValues);
    lines.push(`Progress range: ${min}–${max}`);
  }

  return lines.join('\n');
}

export function formatOperationProceduralReport(
  persisted: WorldStatePersistedState,
  sectors: SectorState[],
): string {
  const lines = [
    'OPERATION PROCEDURAL REPORT',
    `Deploy run: ${persisted.deployRunIndex}`,
    `Cached instances: ${Object.keys(persisted.operationInstances ?? {}).length}`,
    '',
  ];

  SECTOR_WORLD_TEMPLATES.forEach((sector) => {
    const memory = persisted.operationProceduralMemory?.[sector.id];
    lines.push(`${sector.displayName} (${sector.id})`);
    lines.push(`  Recent memory entries: ${memory?.recent.length ?? 0}`);
    lines.push(`  Static title hashes: ${memory?.staticTitleHashes.length ?? 0}`);
    const active = sectors.find((s) => s.id === sector.id)?.activeOperation;
    if (active) {
      lines.push(`  Active: ${active.title} [${active.objectiveKind}]`);
      lines.push(`  Procedural: ${active.procedural ? 'yes' : 'no'}`);
      lines.push(`  Progress goal: ${active.progressRequired}`);
      if (active.bonusObjectives?.length) {
        active.bonusObjectives.forEach((bonus) => {
          lines.push(`    Bonus: ${bonus.description}`);
        });
      }
    }
    lines.push('');
  });

  const validation = formatOperationValidationReport(
    validateActiveOperations(persisted, sectors),
  );
  lines.push(validation);

  return lines.join('\n');
}
