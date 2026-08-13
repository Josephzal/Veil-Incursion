import type {
  RequisitionDeployment,
  RequisitionId,
} from '../types/expeditionRequisition';
import {
  validateExpeditionRequisitionProof,
  type RequisitionValidationIssue,
} from './expeditionRequisitionValidation';

/** @deprecated Internal filename bridge for the canonical Requisition validator. */
export function validateExpeditionKeepsakeEngine(): RequisitionValidationIssue[] {
  return validateExpeditionRequisitionProof();
}

export function auditReportExpeditionKeepsake(): string {
  const issues = validateExpeditionRequisitionProof();
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warn');
  return [
    'EXPEDITION REQUISITION AUDIT',
    'enabled roster size: 15',
    'donor dispositions: 39',
    `total errors: ${errors.length}`,
    `total warnings: ${warnings.length}`,
  ].join('\n');
}

export function formatExpeditionKeepsakeEngineReport(
  equippedRequisitionId?: RequisitionId | null,
  unlockedRequisitionIds?: readonly string[],
  deployment?: RequisitionDeployment | null,
): string {
  const issues = validateExpeditionRequisitionProof();
  return [
    auditReportExpeditionKeepsake(),
    `equipped: ${equippedRequisitionId ?? 'none'}`,
    `unlocked: ${unlockedRequisitionIds?.length ?? 0}`,
    `attunement: ${deployment?.attunement ?? 'none'}`,
    `route doctrine: ${deployment?.routeDoctrine ?? 'none'}`,
    ...issues.map(
      (issue) =>
        `[${issue.severity.toUpperCase()}] ${issue.requisitionId ?? 'global'} — ${issue.message}`,
    ),
  ].join('\n');
}

export function verifyExpeditionKeepsakeEngine(): void {
  const errors = validateExpeditionRequisitionProof().filter(
    (issue) => issue.severity === 'error',
  );
  if (errors.length > 0) {
    throw new Error(
      `verifyExpeditionRequisitionEngine: ${errors
        .map((issue) => issue.message)
        .join('; ')}`,
    );
  }
}
