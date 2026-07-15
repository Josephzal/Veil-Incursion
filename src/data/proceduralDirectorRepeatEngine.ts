import type { ProceduralWorldMemory } from '../types/runWorldBrief';
import type { ProceduralDirectorContext, ProceduralDirectorIssue, ProceduralRepeatReport } from '../types/proceduralDirector';
import { PROCEDURAL_WORLD_MEMORY_DEPTH } from '../types/runWorldBrief';

const REPEAT_CRISIS_THRESHOLD = 3;
const REPEAT_RESOURCE_THRESHOLD = 4;

export function buildProceduralRepeatReport(
  context: ProceduralDirectorContext,
): ProceduralRepeatReport {
  const sectorId = context.sectorState.id;
  const memory = context.memory ?? context.persisted.proceduralWorldMemory;
  const warnings: string[] = [];

  const recentCrisisThemes = memory?.recentCrisisThemesBySector[sectorId] ?? [];
  const recentOperationKinds = memory?.recentOperationKindsBySector?.[sectorId]
    ?? [context.sectorState.activeOperation.objectiveKind];
  const recentContractResources = memory?.recentResourceStressBySector[sectorId] ?? [];

  if (recentCrisisThemes.length >= REPEAT_CRISIS_THRESHOLD) {
    const first = recentCrisisThemes[0];
    const same = recentCrisisThemes.slice(0, REPEAT_CRISIS_THRESHOLD).every((t) => t === first);
    if (same) {
      warnings.push(`Crisis theme ${first} repeated ${REPEAT_CRISIS_THRESHOLD}+ times.`);
    }
  }

  if (recentContractResources.length >= REPEAT_RESOURCE_THRESHOLD) {
    const first = recentContractResources[0];
    const same = recentContractResources.slice(0, REPEAT_RESOURCE_THRESHOLD).every((r) => r === first);
    if (same) {
      warnings.push(`Resource target ${first} repeated too often.`);
    }
  }

  const opKind = context.sectorState.activeOperation.objectiveKind;
  const opRepeats = recentOperationKinds.filter((k) => k === opKind).length;
  if (opRepeats >= 3) {
    warnings.push(`Operation kind ${opKind} repeated ${opRepeats} times in memory.`);
  }

  return {
    sectorId,
    recentCrisisThemes: recentCrisisThemes as ProceduralRepeatReport['recentCrisisThemes'],
    recentOperationKinds,
    recentContractResources,
    warnings,
  };
}

export function repeatIssuesFromReport(report: ProceduralRepeatReport): ProceduralDirectorIssue[] {
  return report.warnings.map((message, i) => ({
    id: `REPEAT_${i}`,
    severity: 'INFO' as const,
    category: 'REPETITION' as const,
    message,
    suggestedFix: 'Reroll theme or resource on next generation.',
  }));
}

export function recordOperationKindInMemory(
  memory: ProceduralWorldMemory,
  sectorId: import('../types/worldState').SectorId,
  objectiveKind: string,
): ProceduralWorldMemory {
  const recent = [objectiveKind, ...(memory.recentOperationKindsBySector?.[sectorId] ?? [])]
    .slice(0, PROCEDURAL_WORLD_MEMORY_DEPTH);
  return {
    ...memory,
    recentOperationKindsBySector: {
      ...memory.recentOperationKindsBySector,
      [sectorId]: recent as import('../types/worldState').OperationObjectiveKind[],
    },
  };
}
