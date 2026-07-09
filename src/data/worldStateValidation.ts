import { getAnchorDefinition } from './anchorRegistry';
import { resolveContributionRules } from './operationRulesEngine';
import { getSectorWorldTemplate, SECTOR_WORLD_TEMPLATES } from './sectorWorldCatalog';
import { ALL_RESOURCE_ITEM_IDS, RESOURCE_REGISTRY } from './resourceRegistry';
import { DEFAULT_OPERATION_PROGRESS_REQUIRED } from './worldStateHelpers';
import type {
  OperationContributionRules,
  OperationObjectiveKind,
  SectorId,
  SectorState,
  WorldStatePersistedState,
} from '../types/worldState';

export interface WorldStateValidationIssue {
  severity: 'warn' | 'error';
  sectorId?: SectorId;
  operationId?: string;
  message: string;
}

function pushIssue(
  issues: WorldStateValidationIssue[],
  issue: WorldStateValidationIssue,
): void {
  issues.push(issue);
}

function normalizeResourceLabel(label: string): string {
  return label.toLowerCase().replace(/[\s-]/g, '');
}

function resolveTargetResourceIds(targetNames: string[] | undefined): string[] {
  if (!targetNames || targetNames.length === 0) return [];
  const normalizedTargets = new Set(targetNames.map(normalizeResourceLabel));
  return ALL_RESOURCE_ITEM_IDS.filter((id) => {
    const def = RESOURCE_REGISTRY[id];
    return normalizedTargets.has(normalizeResourceLabel(def.name))
      || normalizedTargets.has(normalizeResourceLabel(def.shortName));
  });
}

function countContributionRules(rules: OperationContributionRules): number {
  return Object.values(rules).filter((value) => typeof value === 'number' && value > 0).length;
}

function operationHasCompletablePath(objectiveKind: OperationObjectiveKind): boolean {
  const rules = resolveContributionRules(objectiveKind);
  if (countContributionRules(rules) === 0) return false;
  if (rules.defeatEcho) return false;
  return true;
}

export function validateWorldState(
  persisted: WorldStatePersistedState,
  sectors: SectorState[],
): WorldStateValidationIssue[] {
  const issues: WorldStateValidationIssue[] = [];

  sectors.forEach((sector) => {
    const template = getSectorWorldTemplate(sector.id);

    if (!sector.activeAnchor && template.anchor) {
      const anchorId = template.anchor
        ? `anchor-${sector.id.toLowerCase()}-${template.anchor.type.toLowerCase()}`
        : null;
      const dormant = anchorId ? (persisted.dormantAnchorRuns[anchorId] ?? 0) > 0 : false;
      if (!dormant) {
        pushIssue(issues, {
          severity: 'error',
          sectorId: sector.id,
          message: 'Sector has no active anchor despite anchor template.',
        });
      }
    }

    if (!template.anchor) {
      pushIssue(issues, {
        severity: 'warn',
        sectorId: sector.id,
        message: 'Sector template has no anchor definition.',
      });
    } else {
      const anchorDef = getAnchorDefinition(template.anchor.type);
      if (anchorDef.pressureLines.length === 0) {
        pushIssue(issues, {
          severity: 'warn',
          sectorId: sector.id,
          message: `Anchor ${template.anchor.type} has no pressure lines.`,
        });
      }
      if (anchorDef.compatibleOperationTypes.length === 0) {
        pushIssue(issues, {
          severity: 'error',
          sectorId: sector.id,
          message: `Anchor ${template.anchor.type} has no compatible operation types.`,
        });
      }
      const rules = anchorDef.realityRules;
      const hasPressure = rules.combatBias > 0
        || rules.eliteBias > 0
        || rules.anomalyBias > 0
        || rules.echoBias > 0
        || rules.lootBias > 0
        || rules.extractionRiskBias > 0;
      if (!hasPressure) {
        pushIssue(issues, {
          severity: 'warn',
          sectorId: sector.id,
          message: `Anchor ${template.anchor.type} has no pressure effect biases.`,
        });
      }
    }

    const operation = sector.activeOperation;
    if (!operation?.title) {
      pushIssue(issues, {
        severity: 'error',
        sectorId: sector.id,
        message: 'Sector has no active operation.',
      });
      return;
    }

    if (operation.progressRequired <= 0) {
      pushIssue(issues, {
        severity: 'error',
        sectorId: sector.id,
        operationId: operation.id,
        message: 'Operation has no progress goal.',
      });
    } else if (operation.progressRequired !== DEFAULT_OPERATION_PROGRESS_REQUIRED) {
      pushIssue(issues, {
        severity: 'warn',
        sectorId: sector.id,
        operationId: operation.id,
        message: `Operation progress goal is ${operation.progressRequired} (expected ${DEFAULT_OPERATION_PROGRESS_REQUIRED}).`,
      });
    }

    const rules = operation.contributionRules;
    if (countContributionRules(rules) === 0) {
      pushIssue(issues, {
        severity: 'error',
        sectorId: sector.id,
        operationId: operation.id,
        message: 'Operation has no contribution rules.',
      });
    }

    if (rules.defeatEcho) {
      pushIssue(issues, {
        severity: 'warn',
        sectorId: sector.id,
        operationId: operation.id,
        message: 'Operation requires Echo defeats before Echo encounters are implemented.',
      });
    }

    if (!operationHasCompletablePath(operation.objectiveKind)) {
      pushIssue(issues, {
        severity: 'error',
        sectorId: sector.id,
        operationId: operation.id,
        message: 'Operation cannot be completed by currently supported run events.',
      });
    }

    const targetNames = operation.rewardEmphasis.targetResources;
    if (targetNames?.length) {
      const resolvedIds = resolveTargetResourceIds(targetNames);
      if (resolvedIds.length === 0) {
        pushIssue(issues, {
          severity: 'warn',
          sectorId: sector.id,
          operationId: operation.id,
          message: `Operation targets unavailable resources: ${targetNames.join(', ')}.`,
        });
      } else {
        const spawnableInSector = resolvedIds.some((id) =>
          RESOURCE_REGISTRY[id as keyof typeof RESOURCE_REGISTRY].validSectorIds.includes(sector.id),
        );
        if (!spawnableInSector) {
          pushIssue(issues, {
            severity: 'warn',
            sectorId: sector.id,
            operationId: operation.id,
            message: `Operation target resources do not spawn in ${sector.displayName}.`,
          });
        }
      }
    }

    const debriefResolvable = Boolean(
      rules.successfulExtraction
      || rules.emergencyRecallExtraction
      || rules.bankAtSafehouse
      || rules.clearOperationTarget
      || rules.defeatDepthBoss
      || rules.defeatElite
      || rules.defeatAnchorElite
      || rules.clearAnchorCore
      || rules.extractTargetResource,
    );
    if (!debriefResolvable) {
      pushIssue(issues, {
        severity: 'warn',
        sectorId: sector.id,
        operationId: operation.id,
        message: 'No scanner/debrief contribution path resolves for this operation.',
      });
    }
  });

  if (sectors.length !== SECTOR_WORLD_TEMPLATES.length) {
    pushIssue(issues, {
      severity: 'error',
      message: `Expected ${SECTOR_WORLD_TEMPLATES.length} sector states, got ${sectors.length}.`,
    });
  }

  return issues;
}

export function formatWorldStateValidationReport(
  issues: WorldStateValidationIssue[],
): string {
  if (issues.length === 0) return 'World state validation: OK (0 issues).';
  const errors = issues.filter((i) => i.severity === 'error').length;
  const warns = issues.filter((i) => i.severity === 'warn').length;
  const lines = issues.map((issue) => {
    const scope = [issue.sectorId, issue.operationId].filter(Boolean).join(' / ');
    return `[${issue.severity.toUpperCase()}] ${scope ? `${scope}: ` : ''}${issue.message}`;
  });
  return `World state validation: ${errors} error(s), ${warns} warn(s).\n${lines.join('\n')}`;
}

export function logWorldStateValidationWarnings(
  persisted: WorldStatePersistedState,
  sectors: SectorState[],
): WorldStateValidationIssue[] {
  const issues = validateWorldState(persisted, sectors);
  if (typeof __DEV__ === 'undefined' || !__DEV__) return issues;
  issues.forEach((issue) => {
    const prefix = issue.severity === 'error' ? '[WORLD STATE ERROR]' : '[WORLD STATE WARN]';
    const scope = issue.sectorId ?? 'global';
    console.warn(`${prefix} ${scope}: ${issue.message}`);
  });
  return issues;
}
