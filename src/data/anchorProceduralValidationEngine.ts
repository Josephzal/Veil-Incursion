import type { ProceduralAnchorInstance } from '../types/anchorProcedural';
import type { SectorId } from '../types/worldState';
import { catalogFallbackInPool, getSectorAnchorPool } from './anchorSectorPools';
import { SECTOR_WORLD_TEMPLATES } from './sectorWorldCatalog';
import { RESOURCE_REGISTRY } from './resourceRegistry';
import { OPERATION_TEMPLATE_CATALOG } from './operationTemplates';

export type AnchorValidationLevel = 'error' | 'warn' | 'info';

export interface AnchorValidationIssue {
  level: AnchorValidationLevel;
  code: string;
  message: string;
  sectorId?: SectorId;
}

export function validateAnchorPool(sectorId: SectorId): AnchorValidationIssue[] {
  const issues: AnchorValidationIssue[] = [];
  const pool = getSectorAnchorPool(sectorId);
  const valid = pool.filter((e) => e.weight > 0);

  if (valid.length === 0) {
    issues.push({
      level: 'error',
      code: 'EMPTY_POOL',
      message: `Sector ${sectorId} has no valid anchor pool entries.`,
      sectorId,
    });
  } else if (valid.length < 3) {
    issues.push({
      level: 'warn',
      code: 'SMALL_POOL',
      message: `Sector ${sectorId} anchor pool has fewer than 3 valid anchors (${valid.length}).`,
      sectorId,
    });
  }

  const totalWeight = valid.reduce((sum, e) => sum + e.weight, 0);
  if (totalWeight <= 0) {
    issues.push({
      level: 'error',
      code: 'ZERO_WEIGHT',
      message: `Sector ${sectorId} anchor pool total weight <= 0.`,
      sectorId,
    });
  }

  pool.forEach((entry) => {
    if (entry.weight < 0) {
      issues.push({
        level: 'error',
        code: 'NEGATIVE_WEIGHT',
        message: `Sector ${sectorId} anchor ${entry.type} has negative weight.`,
        sectorId,
      });
    }
  });

  if (!catalogFallbackInPool(sectorId)) {
    issues.push({
      level: 'warn',
      code: 'CATALOG_NOT_IN_POOL',
      message: `Sector ${sectorId} catalog fallback anchor missing from pool.`,
      sectorId,
    });
  }

  return issues;
}

export function validateProceduralAnchorInstance(
  instance: ProceduralAnchorInstance,
  recentDisplayNameHashes: string[] = [],
): AnchorValidationIssue[] {
  const issues: AnchorValidationIssue[] = [];
  const { sectorId } = instance;

  if (!instance.id) {
    issues.push({ level: 'error', code: 'MISSING_ID', message: 'Anchor instance missing id.', sectorId });
  }
  if (!instance.sectorId) {
    issues.push({ level: 'error', code: 'MISSING_SECTOR', message: 'Anchor instance missing sectorId.' });
  }
  if (!instance.type) {
    issues.push({ level: 'error', code: 'MISSING_TYPE', message: 'Anchor instance missing type.', sectorId });
  }
  if (!instance.displayName) {
    issues.push({ level: 'error', code: 'MISSING_DISPLAY_NAME', message: 'Anchor instance missing displayName.', sectorId });
  }
  if (!instance.resourceBias) {
    issues.push({ level: 'warn', code: 'MISSING_RESOURCE_BIAS', message: 'Anchor instance missing resourceBias.', sectorId });
  } else {
    instance.resourceBias.forEach((id) => {
      if (!RESOURCE_REGISTRY[id]) {
        issues.push({
          level: 'warn',
          code: 'INVALID_RESOURCE',
          message: `Anchor resourceBias references missing resource ${id}.`,
          sectorId,
        });
      }
    });
  }
  if (!instance.operationBias?.length) {
    issues.push({ level: 'warn', code: 'MISSING_OPERATION_BIAS', message: 'Anchor instance missing operationBias.', sectorId });
  }
  if (!instance.scannerBias) {
    issues.push({ level: 'warn', code: 'MISSING_SCANNER_BIAS', message: 'Anchor instance missing scannerBias.', sectorId });
  }
  if (!instance.encounterBias) {
    issues.push({ level: 'warn', code: 'MISSING_ENCOUNTER_BIAS', message: 'Anchor instance missing encounterBias.', sectorId });
  }
  if (recentDisplayNameHashes.includes(instance.recentMemoryKey)) {
    issues.push({
      level: 'warn',
      code: 'DUPLICATE_DISPLAY_NAME',
      message: `Display name hash repeated in recent memory: ${instance.displayName}.`,
      sectorId,
    });
  }
  if (!['ACTIVE', 'SUPPRESSED', 'DORMANT', 'ROTATING_OUT'].includes(instance.lifecycleState)) {
    issues.push({
      level: 'error',
      code: 'INVALID_LIFECYCLE',
      message: `Invalid lifecycleState: ${instance.lifecycleState}.`,
      sectorId,
    });
  }

  const validKinds = new Set(OPERATION_TEMPLATE_CATALOG.map((t) => t.objectiveKind));
  instance.operationBias?.forEach((kind) => {
    if (!validKinds.has(kind)) {
      issues.push({
        level: 'warn',
        code: 'INVALID_OPERATION_KIND',
        message: `operationBias references unknown kind ${kind}.`,
        sectorId,
      });
    }
  });

  return issues;
}

export function validateAllAnchorPools(): AnchorValidationIssue[] {
  return SECTOR_WORLD_TEMPLATES.flatMap((s) => validateAnchorPool(s.id));
}

export function formatAnchorValidationReport(issues: AnchorValidationIssue[]): string {
  if (issues.length === 0) return 'Anchor validation: no issues.';
  const lines = ['ANCHOR VALIDATION REPORT', ''];
  issues.forEach((issue) => {
    lines.push(`[${issue.level.toUpperCase()}] ${issue.code}: ${issue.message}`);
  });
  return lines.join('\n');
}
