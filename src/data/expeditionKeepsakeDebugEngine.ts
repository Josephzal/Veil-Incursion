import {
  ENABLED_REQUISITION_IDS,
  type RecognizedRequisitionId,
  type RequisitionDeployment,
  type RequisitionId,
} from '../types/expeditionRequisition';
import type { ActiveIncursionState } from '../types/game';
import { formatKeepsakeDebriefPreview, simulateKeepsakeDebriefReport } from './runDebriefKeepsakeEngine';
import { auditReportExpeditionKeepsake, formatExpeditionKeepsakeEngineReport } from './expeditionKeepsakeAuditEngine';
import { formatKeepsakeRuntimeDebugSnapshot } from './keepsakeRunState';

export function formatKeepsakeDebugValidation(
  equippedRequisitionId?: RequisitionId | null,
  unlockedRequisitionIds?: readonly RecognizedRequisitionId[],
  deployment?: RequisitionDeployment | null,
): string {
  return formatExpeditionKeepsakeEngineReport(
    equippedRequisitionId,
    unlockedRequisitionIds,
    deployment,
  );
}

export function formatKeepsakeAcceptanceDebugReport(): string {
  return [
    auditReportExpeditionKeepsake(),
  ].join('\n');
}

export function formatKeepsakeIncursionDebugSnapshot(incursion: ActiveIncursionState): string {
  return [
    formatKeepsakeRuntimeDebugSnapshot(incursion.requisitionRuntime),
    '',
    formatKeepsakeDebriefPreview(incursion.requisitionRuntime),
  ].join('\n');
}

export function listKeepsakeDebugIds(): string {
  return ENABLED_REQUISITION_IDS.join(', ');
}

export function previewKeepsakeDebriefFromIncursion(incursion: ActiveIncursionState): string {
  return simulateKeepsakeDebriefReport(incursion.requisitionRuntime);
}
