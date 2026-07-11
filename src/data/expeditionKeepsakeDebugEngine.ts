import type { KeepsakeDeployment, KeepsakeId } from '../types/expeditionKeepsake';
import type { ActiveIncursionState } from '../types/game';
import { formatKeepsakeDebriefPreview, simulateKeepsakeDebriefReport } from './runDebriefKeepsakeEngine';
import { auditReportExpeditionKeepsake, formatExpeditionKeepsakeEngineReport } from './expeditionKeepsakeAuditEngine';
import { formatKeepsakeAcceptanceReport, validateExpeditionKeepsakeAcceptance } from './expeditionKeepsakeAcceptanceEngine';
import { formatKeepsakeRuntimeDebugSnapshot } from './keepsakeRunState';
import { ALL_KEEPSAKE_IDS } from './expeditionKeepsakeRegistry';

export function formatKeepsakeDebugValidation(
  equippedKeepsakeId?: KeepsakeId | null,
  unlockedKeepsakeIds?: readonly KeepsakeId[],
  deployment?: KeepsakeDeployment | null,
): string {
  return formatExpeditionKeepsakeEngineReport(equippedKeepsakeId, unlockedKeepsakeIds, deployment);
}

export function formatKeepsakeAcceptanceDebugReport(): string {
  return [
    auditReportExpeditionKeepsake(),
    '',
    formatKeepsakeAcceptanceReport(validateExpeditionKeepsakeAcceptance()),
  ].join('\n');
}

export function formatKeepsakeIncursionDebugSnapshot(incursion: ActiveIncursionState): string {
  return [
    formatKeepsakeRuntimeDebugSnapshot(incursion.keepsakeRuntime),
    '',
    formatKeepsakeDebriefPreview(incursion.keepsakeRuntime),
  ].join('\n');
}

export function listKeepsakeDebugIds(): string {
  return ALL_KEEPSAKE_IDS.join(', ');
}

export function previewKeepsakeDebriefFromIncursion(incursion: ActiveIncursionState): string {
  return simulateKeepsakeDebriefReport(incursion.keepsakeRuntime);
}
