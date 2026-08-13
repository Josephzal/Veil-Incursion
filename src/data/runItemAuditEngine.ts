import {
  formatRunItemValidationReport,
  validateRunItemPipeline,
  validateRunItemRegistry,
} from './runItemValidation';
import type { RunItemValidationIssue } from './runItemValidation';
import { ALL_RUN_ITEM_IDS, RUN_ITEM_COMBAT_IDS, RUN_ITEM_FIELD_IDS } from '../types/runItem';
import {
  formatRunItemAcceptanceReport,
  validateCombatBehaviorWiringGuard,
  validateRunItemAcceptance,
} from './runItemAcceptanceEngine';

/** Combat items must stay out of passive stat-stick territory — 0 AP, one per turn enforced in engine. */
export function validateRunItemCombatPolicyAudit(): RunItemValidationIssue[] {
  const issues: RunItemValidationIssue[] = [];
  const perTurn = validateCombatBehaviorWiringGuard();
  if (perTurn.length > 0) {
    issues.push(...perTurn);
  }
  return issues;
}

export function validateRunItemEngine(): RunItemValidationIssue[] {
  return [
    ...validateRunItemRegistry(),
    ...validateRunItemCombatPolicyAudit(),
    ...validateRunItemAcceptance(),
  ];
}

export function auditReportRunItems(): string {
  const registry = validateRunItemRegistry();
  const acceptance = validateRunItemAcceptance();
  const errors = [...registry, ...acceptance].filter((issue) => issue.severity === 'error').length;
  const warnings = [...registry, ...acceptance].filter((issue) => issue.severity === 'warn').length;

  return [
    'SUPPLY AUDIT',
    `roster size: ${ALL_RUN_ITEM_IDS.length}`,
    `combat consumables: ${RUN_ITEM_COMBAT_IDS.length}`,
    `field tools: ${RUN_ITEM_FIELD_IDS.length}`,
    `registry errors: ${registry.filter((issue) => issue.severity === 'error').length}`,
    `acceptance errors: ${acceptance.filter((issue) => issue.severity === 'error').length}`,
    `total errors: ${errors}`,
    `total warnings: ${warnings}`,
  ].join('\n');
}

export function formatRunItemEngineReport(
  incursion?: Parameters<typeof validateRunItemPipeline>[0],
): string {
  const pipeline = validateRunItemPipeline(incursion ?? null);
  const acceptance = validateRunItemAcceptance();
  return [
    auditReportRunItems(),
    '',
    formatRunItemValidationReport(pipeline),
    '',
    formatRunItemAcceptanceReport(acceptance),
  ].join('\n');
}

/** Throw on registry/acceptance errors — boot verify for Cargo Supplies v2. */
export function verifyRunItemEngine(): void {
  const errors = validateRunItemEngine().filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `verifyRunItemEngine: ${errors.map((issue) => issue.message).join('; ')}`,
    );
  }
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  try {
    verifyRunItemEngine();
  } catch (error) {
    console.warn(
      error instanceof Error ? error.message : 'verifyRunItemEngine failed.',
    );
  }
}
