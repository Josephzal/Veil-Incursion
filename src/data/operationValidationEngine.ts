import type { SectorOperationTemplate } from './sectorWorldCatalog';
import { getSectorWorldTemplate } from './sectorWorldCatalog';
import { ALL_RESOURCE_ITEM_IDS, RESOURCE_REGISTRY } from './resourceRegistry';
import { DEFAULT_OPERATION_PROGRESS_REQUIRED } from './worldStateHelpers';
import type {
  OperationContributionRules,
  OperationObjectiveKind,
  SectorId,
  SectorState,
  WorldStatePersistedState,
} from '../types/worldState';

const PLACEHOLDER_PATTERN = /\{[a-z_]+\}/i;
const PROCEDURAL_PROGRESS_MIN = 82;
const PROCEDURAL_PROGRESS_MAX = 124;

export interface OperationValidationIssue {
  severity: 'warn' | 'error';
  sectorId?: SectorId;
  operationId?: string;
  message: string;
}

function countContributionRules(rules: OperationContributionRules): number {
  return Object.values(rules).filter((value) => typeof value === 'number' && value > 0).length;
}

function operationHasCompletablePath(rules: OperationContributionRules): boolean {
  const ruleCount = countContributionRules(rules);
  if (ruleCount === 0) return false;
  if (rules.defeatEcho && ruleCount <= 1) return false;
  return true;
}

function validateTemplate(
  template: SectorOperationTemplate,
  sectorId: SectorId,
  issues: OperationValidationIssue[],
): void {
  if (!template.title?.trim()) {
    issues.push({
      severity: 'error',
      sectorId,
      operationId: template.id,
      message: 'Operation has no title.',
    });
  }

  if (PLACEHOLDER_PATTERN.test(template.title) || PLACEHOLDER_PATTERN.test(template.description)) {
    issues.push({
      severity: 'error',
      sectorId,
      operationId: template.id,
      message: 'Operation text still contains unresolved placeholders.',
    });
  }

  const progressRequired = template.progressRequired ?? DEFAULT_OPERATION_PROGRESS_REQUIRED;
  if (progressRequired <= 0) {
    issues.push({
      severity: 'error',
      sectorId,
      operationId: template.id,
      message: 'Operation has no progress goal.',
    });
  } else if (
    template.procedural
    && (progressRequired < PROCEDURAL_PROGRESS_MIN || progressRequired > PROCEDURAL_PROGRESS_MAX)
  ) {
    issues.push({
      severity: 'warn',
      sectorId,
      operationId: template.id,
      message: `Procedural progress goal ${progressRequired} is outside expected range ${PROCEDURAL_PROGRESS_MIN}–${PROCEDURAL_PROGRESS_MAX}.`,
    });
  }

  const rules = template.contributionRules;
  if (!rules || countContributionRules(rules) === 0) {
    issues.push({
      severity: 'error',
      sectorId,
      operationId: template.id,
      message: 'Operation has no contribution rules.',
    });
  } else if (!operationHasCompletablePath(rules)) {
    issues.push({
      severity: 'error',
      sectorId,
      operationId: template.id,
      message: 'Operation cannot be completed by currently supported run events.',
    });
  }

  const targetIds = template.targetResourceIds ?? [];
  targetIds.forEach((id) => {
    if (!ALL_RESOURCE_ITEM_IDS.includes(id)) {
      issues.push({
        severity: 'error',
        sectorId,
        operationId: template.id,
        message: `Operation targets unknown resource id: ${id}.`,
      });
    }
  });

  const rewardTargets = template.rewardEmphasis.targetResources ?? [];
  rewardTargets.forEach((label) => {
    const normalized = label.toLowerCase().replace(/[\s-]/g, '');
    const resolved = ALL_RESOURCE_ITEM_IDS.some((id) => {
      const def = RESOURCE_REGISTRY[id];
      return normalized === def.name.toLowerCase().replace(/[\s-]/g, '')
        || normalized === def.shortName.toLowerCase().replace(/[\s-]/g, '');
    });
    if (!resolved) {
      issues.push({
        severity: 'warn',
        sectorId,
        operationId: template.id,
        message: `Reward emphasis references unavailable resource: ${label}.`,
      });
    }
  });

  if (template.procedural && !template.completionEffect) {
    issues.push({
      severity: 'warn',
      sectorId,
      operationId: template.id,
      message: 'Procedural operation missing completionEffect.',
    });
  }

  template.bonusObjectives?.forEach((bonus) => {
    if (!bonus.description?.trim()) {
      issues.push({
        severity: 'warn',
        sectorId,
        operationId: template.id,
        message: `Bonus objective ${bonus.id} has no description.`,
      });
    }
  });
}

export function validateActiveOperations(
  persisted: WorldStatePersistedState,
  sectors: SectorState[],
): OperationValidationIssue[] {
  const issues: OperationValidationIssue[] = [];

  sectors.forEach((sector) => {
    const operation = sector.activeOperation;
    if (!operation?.title) {
      issues.push({
        severity: 'error',
        sectorId: sector.id,
        message: 'Sector has no active operation.',
      });
      return;
    }

    if (operation.procedural && !persisted.operationInstances?.[operation.id]) {
      issues.push({
        severity: 'warn',
        sectorId: sector.id,
        operationId: operation.id,
        message: 'Active procedural operation is not cached in operationInstances.',
      });
    }

    validateTemplate(
      {
        id: operation.id,
        title: operation.title,
        description: operation.description,
        objectiveKind: operation.objectiveKind,
        rewardEmphasis: operation.rewardEmphasis,
        procedural: operation.procedural,
        progressRequired: operation.progressRequired,
        contributionRules: operation.contributionRules,
        targetResourceIds: operation.targetResourceIds,
        bonusObjectives: operation.bonusObjectives,
        completionEffectSummary: operation.completionEffectSummary,
      },
      sector.id,
      issues,
    );

    const sectorTemplate = getSectorWorldTemplate(sector.id);
    if (sectorTemplate.anchor) {
      const anchorDef = sectorTemplate.anchor;
      const compatibleKinds: OperationObjectiveKind[] = [
        'RESOURCE_SURVEY',
        'ECHO_RECOVERY',
        'EXTRACTION_SURGE',
        'ANCHOR_ASSAULT',
        'BOSS_SUPPRESSION',
      ];
      if (!compatibleKinds.includes(operation.objectiveKind)) {
        issues.push({
          severity: 'warn',
          sectorId: sector.id,
          operationId: operation.id,
          message: `Unknown objective kind: ${operation.objectiveKind}.`,
        });
      }
      void anchorDef;
    }
  });

  return issues;
}

export function formatOperationValidationReport(issues: OperationValidationIssue[]): string {
  if (issues.length === 0) {
    return 'OPERATION VALIDATION — no issues found.';
  }
  const lines = ['OPERATION VALIDATION', ''];
  issues.forEach((issue) => {
    const scope = [issue.sectorId, issue.operationId].filter(Boolean).join(' / ');
    lines.push(`[${issue.severity.toUpperCase()}] ${scope ? `${scope}: ` : ''}${issue.message}`);
  });
  return lines.join('\n');
}
