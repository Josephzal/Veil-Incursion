import type { RunWorldBrief } from '../types/runWorldBrief';
import type { ProceduralDirectorContext, ProceduralDirectorIssue } from '../types/proceduralDirector';
import type { ResourceItemId } from '../types/resourceItem';
import { canResourceSpawnInSector } from './resourceRegistry';

export function validateOperationAchievability(
  brief: RunWorldBrief,
  context: ProceduralDirectorContext,
): ProceduralDirectorIssue[] {
  const issues: ProceduralDirectorIssue[] = [];
  const op = brief.operationInstance;
  const sectorId = context.sectorState.id;

  (op.targetResourceIds ?? []).forEach((id) => {
    if (!canResourceSpawnInSector(id, sectorId)) {
      issues.push({
        id: 'OPERATION_RESOURCE_IMPOSSIBLE',
        severity: 'WARNING',
        category: 'IMPOSSIBLE_OBJECTIVE',
        message: `Operation targets resource ${id} that cannot spawn in ${sectorId}.`,
        suggestedFix: 'Reroll target resource to sector pool.',
      });
    }
  });

  const overlays = op.targetNodeOverlays ?? [];
  if (overlays.includes('ANCHOR_SIGNAL') && !brief.anchorInstance) {
    issues.push({
      id: 'OPERATION_ANCHOR_SIGNAL_NO_ANCHOR',
      severity: 'WARNING',
      category: 'IMPOSSIBLE_OBJECTIVE',
      message: 'Operation requires Anchor Signal but no active anchor.',
    });
  }

  return issues;
}

export function validateContractAchievability(
  brief: RunWorldBrief,
  context: ProceduralDirectorContext,
): ProceduralDirectorIssue[] {
  const issues: ProceduralDirectorIssue[] = [];
  const sectorId = context.sectorState.id;

  brief.contractBoard.forEach((contract) => {
    const resourceIds = [
      ...(contract.targetResourceId ? [contract.targetResourceId] : []),
      ...(contract.targetResourceOptions ?? []),
    ];
    if (resourceIds.length > 0) {
      const spawnable = resourceIds.some((id) => canResourceSpawnInSector(id, sectorId));
      if (!spawnable) {
        issues.push({
          id: `CONTRACT_RESOURCE_${contract.id}`,
          severity: 'WARNING',
          category: 'IMPOSSIBLE_OBJECTIVE',
          message: `Contract "${contract.title}" targets resources not spawnable in sector.`,
          suggestedFix: 'Reroll contract resource on board refresh.',
        });
      }
    }
  });

  if (context.selectedContractId) {
    const selected = brief.contractBoard.find((c) => c.id === context.selectedContractId);
    const selectedResources = selected
      ? [
        ...(selected.targetResourceId ? [selected.targetResourceId] : []),
        ...(selected.targetResourceOptions ?? []),
      ]
      : [];
    if (selectedResources.length) {
      const ok = selectedResources.some((id) => canResourceSpawnInSector(id, sectorId));
      if (!ok) {
        issues.push({
          id: 'SELECTED_CONTRACT_IMPOSSIBLE',
          severity: 'WARNING',
          category: 'IMPOSSIBLE_OBJECTIVE',
          message: 'Selected contract may be impossible in this sector.',
        });
      }
    }
  }

  return issues;
}

export function applyAchievabilityFixes(brief: RunWorldBrief): {
  brief: RunWorldBrief;
  applied: boolean;
} {
  const sectorId = brief.sectorId;
  const stress = { ...brief.resourceStress };
  let changed = false;

  const fixIds = (ids: ResourceItemId[]): ResourceItemId[] =>
    ids.filter((id): id is ResourceItemId => canResourceSpawnInSector(id, sectorId));

  const primary = fixIds(stress.primaryResourceIds);
  if (primary.length !== stress.primaryResourceIds.length) {
    stress.primaryResourceIds = primary.length ? primary : stress.secondaryResourceIds.slice(0, 2);
    changed = true;
  }

  if (!changed) return { brief, applied: false };
  return {
    brief: { ...brief, resourceStress: stress },
    applied: true,
  };
}
