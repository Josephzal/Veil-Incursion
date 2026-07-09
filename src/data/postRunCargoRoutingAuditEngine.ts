import {
  validatePostRunCargoRoutingPipeline,
} from './postRunCargoRoutingValidation';
import {
  ALL_RESOURCE_ITEM_IDS,
  canResourceBeSoldToFence,
  getResourceCategory,
  RESOURCE_REGISTRY,
} from './resourceRegistry';

export interface PostRunCargoRoutingAuditStats {
  specialResourceCount: number;
  fenceEligibleCount: number;
  contractTargetCount: number;
  operationTargetCount: number;
  hubOpenableCount: number;
  partialRoutingCapableCount: number;
}

export function collectPostRunCargoRoutingAuditStats(): PostRunCargoRoutingAuditStats {
  let specialResourceCount = 0;
  let fenceEligibleCount = 0;
  let contractTargetCount = 0;
  let operationTargetCount = 0;
  let hubOpenableCount = 0;
  let partialRoutingCapableCount = 0;

  ALL_RESOURCE_ITEM_IDS.forEach((resourceId) => {
    const def = RESOURCE_REGISTRY[resourceId];
    const isSpecial = getResourceCategory(resourceId) !== 'STABLE'
      || def.canBeContractTarget
      || def.canBeOperationTarget;
    if (isSpecial) specialResourceCount += 1;
    if (canResourceBeSoldToFence(resourceId)) fenceEligibleCount += 1;
    if (def.canBeContractTarget) contractTargetCount += 1;
    if (def.canBeOperationTarget) operationTargetCount += 1;
    if (def.canOpenAtHub) hubOpenableCount += 1;
    if (def.maxStack > 1 && (def.canBeSoldToFence || def.canBeContractTarget || def.canBeOperationTarget)) {
      partialRoutingCapableCount += 1;
    }
  });

  return {
    specialResourceCount,
    fenceEligibleCount,
    contractTargetCount,
    operationTargetCount,
    hubOpenableCount,
    partialRoutingCapableCount,
  };
}

export function auditReportPostRunCargoRouting(): string {
  const stats = collectPostRunCargoRoutingAuditStats();
  return [
    'POST-RUN CARGO ROUTING AUDIT',
    `special resources: ${stats.specialResourceCount}`,
    `fence-eligible: ${stats.fenceEligibleCount}`,
    `contract targets: ${stats.contractTargetCount}`,
    `operation targets: ${stats.operationTargetCount}`,
    `hub-openable: ${stats.hubOpenableCount}`,
    `partial-routing capable: ${stats.partialRoutingCapableCount}`,
  ].join('\n');
}

/** Phase 10 — consolidated fixtures and deprecated routing exports removed. */
export function verifyLegacyRoutingCleanup(): void {
  const stats = collectPostRunCargoRoutingAuditStats();
  if (stats.specialResourceCount <= 0) {
    throw new Error('verifyLegacyRoutingCleanup: special resource catalog appears empty.');
  }
  if (stats.fenceEligibleCount <= 0) {
    throw new Error('verifyLegacyRoutingCleanup: fence-eligible resource catalog appears empty.');
  }
}

/** Throw on catalog/pipeline errors — mirrors encounter `verifyEncounterCatalog`. */
export function verifyPostRunCargoRouting(): void {
  const issues = validatePostRunCargoRoutingPipeline();
  const errors = issues.filter((issue) => issue.severity === 'error');
  if (errors.length > 0) {
    throw new Error(
      `verifyPostRunCargoRouting: ${errors.map((issue) => issue.message).join('; ')}`,
    );
  }
}

/** Central boot-time verify — mirrors `verifyEncounterGenerator`. */
export function verifyPostRunCargoRoutingEngine(): void {
  verifyPostRunCargoRouting();
  verifyLegacyRoutingCleanup();
}

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  try {
    verifyPostRunCargoRoutingEngine();
  } catch (error) {
    console.warn(
      error instanceof Error ? error.message : 'verifyPostRunCargoRoutingEngine failed.',
    );
  }
}
