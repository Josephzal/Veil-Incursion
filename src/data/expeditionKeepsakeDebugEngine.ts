import type { KeepsakeId } from '../types/expeditionKeepsake';
import type { ActiveIncursionState } from '../types/game';
import { buildKeepsakeDebriefSummary, formatKeepsakeDebriefPreview } from './runDebriefKeepsakeEngine';
import { formatKeepsakeRuntimeDebugSnapshot } from './keepsakeRunState';
import {
  formatKeepsakeValidationReport,
  validateExpeditionKeepsakePipeline,
} from './expeditionKeepsakeValidation';
import { ALL_KEEPSAKE_IDS } from './expeditionKeepsakeRegistry';

export function formatKeepsakeDebugValidation(
  equippedKeepsakeId?: KeepsakeId | null,
  unlockedKeepsakeIds?: readonly KeepsakeId[],
): string {
  return formatKeepsakeValidationReport(
    validateExpeditionKeepsakePipeline(equippedKeepsakeId, unlockedKeepsakeIds),
  );
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
  const summary = buildKeepsakeDebriefSummary(incursion.keepsakeRuntime);
  if (!summary) return 'KEEPSAKE DEBRIEF PREVIEW — none equipped.';
  return [
    'KEEPSAKE DEBRIEF PREVIEW',
    `name: ${summary.name}`,
    `triggered: ${summary.triggered}`,
    `triggers: ${summary.triggerCount}`,
    ...(summary.note ? [summary.note] : summary.statLines),
  ].join('\n');
}
