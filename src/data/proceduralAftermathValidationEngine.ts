import type { SectorAftermathModifier } from '../types/proceduralAftermath';
import type { SectorId, WorldStatePersistedState } from '../types/worldState';
import { AFTERMATH_RULES } from './proceduralAftermathCatalog';
import { MAX_SECTOR_AFTERMATH_MODIFIERS } from '../types/proceduralAftermath';

export interface AftermathValidationIssue {
  id: string;
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
}

export function validateSectorAftermathModifier(mod: SectorAftermathModifier): AftermathValidationIssue[] {
  const issues: AftermathValidationIssue[] = [];

  if (!mod.id || !mod.stackKey) {
    issues.push({ id: 'MISSING_ID', severity: 'ERROR', message: 'Aftermath modifier missing id or stackKey' });
  }
  if (mod.remainingRuns < 0 || mod.durationRuns < 1) {
    issues.push({ id: 'INVALID_DURATION', severity: 'ERROR', message: 'Invalid duration or remaining runs' });
  }
  if (mod.intensity < 1 || mod.intensity > 3) {
    issues.push({ id: 'INVALID_INTENSITY', severity: 'ERROR', message: `Intensity ${mod.intensity} out of range` });
  }
  if (!AFTERMATH_RULES.some((r) => r.type === mod.type)) {
    issues.push({ id: 'UNKNOWN_TYPE', severity: 'WARNING', message: `Unknown aftermath type: ${mod.type}` });
  }
  if (!mod.displayName || !mod.description) {
    issues.push({ id: 'MISSING_COPY', severity: 'WARNING', message: 'Missing display name or description' });
  }

  return issues;
}

export function validateSectorAftermathState(
  persisted: WorldStatePersistedState,
  sectorId: SectorId,
): AftermathValidationIssue[] {
  const issues: AftermathValidationIssue[] = [];
  const mods = persisted.sectorAftermathModifiersBySector?.[sectorId] ?? [];

  if (mods.length > MAX_SECTOR_AFTERMATH_MODIFIERS) {
    issues.push({
      id: 'CAP_EXCEEDED',
      severity: 'ERROR',
      message: `Sector ${sectorId} has ${mods.length} aftermath modifiers (max ${MAX_SECTOR_AFTERMATH_MODIFIERS})`,
    });
  }

  const stackKeys = new Set<string>();
  mods.forEach((mod) => {
    if (stackKeys.has(mod.stackKey)) {
      issues.push({
        id: 'DUPLICATE_STACK_KEY',
        severity: 'ERROR',
        message: `Duplicate stackKey ${mod.stackKey} on sector ${sectorId}`,
      });
    }
    stackKeys.add(mod.stackKey);
    issues.push(...validateSectorAftermathModifier(mod));
  });

  return issues;
}

export function formatAftermathValidationReport(
  issues: AftermathValidationIssue[],
): string {
  if (!issues.length) return 'Aftermath validation: OK';
  return [
    'AFTERMATH VALIDATION',
    ...issues.map((i) => `  [${i.severity}] ${i.id}: ${i.message}`),
  ].join('\n');
}

export function validateAllSectorAftermath(
  persisted: WorldStatePersistedState,
): AftermathValidationIssue[] {
  const sectors = Object.keys(persisted.sectorAftermathModifiersBySector ?? {}) as SectorId[];
  return sectors.flatMap((id) => validateSectorAftermathState(persisted, id));
}
