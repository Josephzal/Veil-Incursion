import type { ActiveIncursionState } from '../types/game';
import { createDefaultActiveIncursionState } from '../types/game';
import type { ContractResult } from '../types/contract';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import type { RunResourceLedger } from '../types/runResourceLedger';
import type { CargoRoutingAction } from '../types/postRunCargoRouting';
import type { RunGenerationContext } from '../types/worldState';
import { buildOperationDebriefPayload } from './runDebriefEngine';
import { buildDeathResourceSections } from './runDebriefResourceEngine';
import { resolveContractExtractionKind } from './contractExtractionKind';
import { resolveContractPendingDelivery, resolveContractResult } from './contractResolver';
import { resolveRunDeathResourceState } from './runResourceLedgerEngine';
import { createDefaultCargoRunState } from '../types/cargoGrid';
import { createEmptyContractRunProgress } from '../types/contract';
import {
  applyCargoRoutingDecisions,
  buildDefaultRoutingDecisions,
  buildPostRunRoutingDebriefState,
  formatAutoStashedSummary,
  resolveFinalContractResultAfterRouting,
} from './postRunCargoRoutingEngine';
import {
  formatPostRunCargoRoutingValidationReport,
  validateCargoRoutingResultIntegrity,
  validatePostRunCargoRoutingPipeline,
} from './postRunCargoRoutingValidation';
import type { PostRunRoutingDebriefState } from '../types/postRunCargoRouting';
import { createDefaultEchoRunState } from './echoRunState';
import { createDefaultCargoRoutingRunState } from './postRunCargoRoutingRunState';
import { auditReportPostRunCargoRouting } from './postRunCargoRoutingAuditEngine';
import { formatCargoRoutingDebriefPreview } from './runDebriefCargoRoutingEngine';
import { createEmptyRunResourceLedger } from '../types/runResourceLedger';
import { POST_RUN_ROUTING_TEST_LEDGER, mergeTestResourcesIntoLedger } from './postRunCargoRoutingFixtures';

export function buildPostRunRoutingPreview(incursion: ActiveIncursionState): string {
  const context = incursion.runGenerationContext;
  if (!context) return 'POST-RUN ROUTING — no run generation context.';

  const routingState = buildPostRunRoutingDebriefState({
    ledger: incursion.runResourceLedger,
    contract: incursion.activeContract,
    operationObjectiveKind: context.activeOperation.objectiveKind,
    operationTargetResourceNames: context.activeOperation.rewardEmphasis.targetResources,
    operationId: context.activeOperation.id,
    contractProgress: incursion.contractRunProgress,
    extractionKind: resolveContractExtractionKind(incursion),
  });

  const lines = [
    'POST-RUN ROUTING PREVIEW',
    `requires routing: ${routingState.requiresRouting ? 'yes' : 'no'}`,
    `pending items: ${routingState.pendingItems.length}`,
    `auto-stashed: ${formatAutoStashedSummary(routingState.autoStashed)}`,
    `contract pending delivery: ${routingState.initialContractPendingDelivery ? 'yes' : 'no'}`,
  ];

  routingState.pendingItems.forEach((item) => {
    lines.push(
      `- ${item.resourceId} x${item.quantity} [${item.source}] recommended=${item.recommendedAction} contract=${item.isContractTarget} operation=${item.isOperationTarget}`,
    );
  });

  return lines.join('\n');
}

function simulateWithOverrides(
  incursion: ActiveIncursionState,
  overrides: Partial<Record<ResourceItemId, CargoRoutingAction>>,
): string {
  const context = incursion.runGenerationContext;
  if (!context) return 'POST-RUN ROUTING SIM — no run generation context.';

  const routingState = buildPostRunRoutingDebriefState({
    ledger: incursion.runResourceLedger,
    contract: incursion.activeContract,
    operationObjectiveKind: context.activeOperation.objectiveKind,
    operationTargetResourceNames: context.activeOperation.rewardEmphasis.targetResources,
    operationId: context.activeOperation.id,
    contractProgress: incursion.contractRunProgress,
    extractionKind: resolveContractExtractionKind(incursion),
  });

  if (!routingState.requiresRouting) {
    return 'POST-RUN ROUTING SIM — no routable cargo on active ledger.';
  }

  const decisions = buildDefaultRoutingDecisions(routingState.pendingItems).map((decision) => ({
    ...decision,
    action: overrides[decision.resourceId] ?? decision.action,
  }));

  const applied = applyCargoRoutingDecisions({
    decisions,
    items: routingState.pendingItems,
    autoStashed: routingState.autoStashed,
    stash: {},
    cabalCredits: 0,
    operationContributionPerStack: routingState.operationContributionPerStack,
  });

  const finalContract = resolveFinalContractResultAfterRouting(
    routingState,
    applied.result,
    decisions,
    routingState.pendingItems,
    true,
    incursion.runResourceLedger,
  );

  const lines = [
    'POST-RUN ROUTING SIM RESULT',
    `fence credits: +${applied.result.creditsFromFence}`,
    `rival credits: +${applied.result.creditsFromRivalDelivery}`,
    `operation progress: +${applied.result.operationProgressFromCargo}`,
    `contract status: ${finalContract.status}`,
    `contract outcome: ${finalContract.outcomeKind ?? 'n/a'}`,
    `contract progress: ${finalContract.progressText}`,
    finalContract.betrayalSummary ? `betrayal: ${finalContract.betrayalSummary}` : '',
    ...applied.result.outcomeLines.map((line) => line.label),
  ].filter(Boolean);

  const integrityIssues = validateCargoRoutingResultIntegrity(
    routingState.pendingItems,
    decisions,
    applied.result,
  );

  if (integrityIssues.length > 0) {
    lines.push('INTEGRITY ISSUES:');
    integrityIssues.forEach((issue) => lines.push(`- ${issue.message}`));
  }

  return lines.join('\n');
}

export function simulatePostRunRoutingResult(
  incursion: ActiveIncursionState,
  overrides?: Partial<Record<ResourceItemId, CargoRoutingAction>>,
): string {
  return simulateWithOverrides(incursion, overrides ?? {});
}

export function simulatePostRunRoutingSellAll(incursion: ActiveIncursionState): string {
  const overrides = Object.fromEntries(
    POST_RUN_ROUTING_TEST_RESOURCES.map((id) => [id, 'SELL_FENCE' as const]),
  ) as Partial<Record<ResourceItemId, CargoRoutingAction>>;
  return simulateWithOverrides(incursion, overrides);
}

export function simulatePostRunRoutingDeliverAll(incursion: ActiveIncursionState): string {
  const overrides = Object.fromEntries(
    POST_RUN_ROUTING_TEST_RESOURCES.map((id) => [id, 'DELIVER_SPONSOR' as const]),
  ) as Partial<Record<ResourceItemId, CargoRoutingAction>>;
  return simulateWithOverrides(incursion, overrides);
}

export function simulatePostRunRoutingContributeAll(incursion: ActiveIncursionState): string {
  const overrides = Object.fromEntries(
    POST_RUN_ROUTING_TEST_RESOURCES.map((id) => [id, 'CONTRIBUTE_OPERATION' as const]),
  ) as Partial<Record<ResourceItemId, CargoRoutingAction>>;
  return simulateWithOverrides(incursion, overrides);
}

export function simulatePostRunRoutingOpenCaskets(incursion: ActiveIncursionState): string {
  return simulateWithOverrides(incursion, { 'sealed-containment-casket': 'OPEN_AT_HUB' });
}

export function simulatePostRunRoutingPartialDogTags(incursion: ActiveIncursionState): string {
  const context = incursion.runGenerationContext;
  if (!context) return 'POST-RUN ROUTING SIM — no run generation context.';

  const routingState = buildPostRunRoutingDebriefState({
    ledger: incursion.runResourceLedger,
    contract: incursion.activeContract,
    operationObjectiveKind: context.activeOperation.objectiveKind,
    operationTargetResourceNames: context.activeOperation.rewardEmphasis.targetResources,
    operationId: context.activeOperation.id,
    contractProgress: incursion.contractRunProgress,
    extractionKind: resolveContractExtractionKind(incursion),
  });

  if (!routingState.pendingItems.some((item) => item.resourceId === 'tarnished-dog-tags')) {
    return 'POST-RUN ROUTING SIM — no dog tags on active ledger.';
  }

  const decisions = buildDefaultRoutingDecisions(routingState.pendingItems).map((decision) => (
    decision.resourceId === 'tarnished-dog-tags'
      ? { ...decision, action: 'SELL_FENCE' as const, quantity: 2 }
      : decision
  ));

  const applied = applyCargoRoutingDecisions({
    decisions,
    items: routingState.pendingItems,
    autoStashed: routingState.autoStashed,
    stash: {},
    cabalCredits: 0,
    operationContributionPerStack: routingState.operationContributionPerStack,
  });

  const integrityIssues = validateCargoRoutingResultIntegrity(
    routingState.pendingItems,
    decisions,
    applied.result,
  );

  return [
    'POST-RUN ROUTING SIM — PARTIAL DOG TAGS',
    `fence credits: +${applied.result.creditsFromFence}`,
    `kept: ${formatAutoStashedSummary(applied.result.kept)}`,
    ...applied.result.outcomeLines.map((line) => line.label),
    ...(integrityIssues.length > 0
      ? ['INTEGRITY ISSUES:', ...integrityIssues.map((issue) => issue.message)]
      : []),
  ].join('\n');
}

export function buildMockRoutingLedger(
  resources: ResourceQuantity,
  opts?: { banked?: ResourceQuantity; lostOnDeath?: ResourceQuantity },
): RunResourceLedger {
  return {
    collected: { ...resources, ...(opts?.banked ?? {}) },
    bankedAtSafehouse: { ...(opts?.banked ?? {}) },
    extracted: { ...resources },
    lostOnDeath: { ...(opts?.lostOnDeath ?? {}) },
    consumed: {},
    safehouseBankActions: 0,
  };
}

export function buildDeathRoutingPreview(
  extracted: ResourceQuantity,
  banked: ResourceQuantity,
): string {
  const deathResources = resolveRunDeathResourceState(
    createDefaultCargoRunState(),
    { resources: banked, consumables: {} },
    buildMockRoutingLedger(extracted, { banked }),
  );

  const sections = buildDeathResourceSections(deathResources.ledger);
  const lines = [
    'POST-RUN DEATH ROUTING PREVIEW',
    `lost resources: ${formatAutoStashedSummary(deathResources.lostResources) || 'none'}`,
    `banked survived: ${formatAutoStashedSummary(deathResources.bankedResources) || 'none'}`,
  ];

  sections.forEach((section) => {
    lines.push(`${section.title}: ${section.lines.map((line) => `${line.quantity}x ${line.label}`).join(', ') || 'none'}`);
  });

  return lines.join('\n');
}

export function buildBankThenDeathRoutingPreview(
  extracted: ResourceQuantity,
  banked: ResourceQuantity,
): string {
  return [
    buildDeathRoutingPreview(extracted, banked),
    '',
    'NOTE: banked safehouse cargo auto-deposits to hub stash on death; manual post-run routing is extract-only in v1.',
  ].join('\n');
}

export function formatPostRunRoutingDebugValidation(
  routingState?: PostRunRoutingDebriefState | null,
): string {
  return formatPostRunCargoRoutingValidationReport(
    validatePostRunCargoRoutingPipeline(routingState),
  );
}

export function auditPostRunCargoRoutingReport(): string {
  return auditReportPostRunCargoRouting();
}

export const POST_RUN_ROUTING_TEST_RESOURCES: ResourceItemId[] = [
  'smugglers-ledger',
  'tarnished-dog-tags',
  'sealed-containment-casket',
  'encrypted-grid-drive',
  'sanguine-ampoule',
];

export { POST_RUN_ROUTING_TEST_LEDGER, mergeTestResourcesIntoLedger } from './postRunCargoRoutingFixtures';

export function buildDevPostRunDebriefPreview(
  incursion: ActiveIncursionState,
  ledgerOverride?: RunResourceLedger,
): string {
  const context = incursion.runGenerationContext;
  if (!context) return 'POST-RUN DEBRIEF PREVIEW — no run generation context.';

  const ledger = ledgerOverride ?? incursion.runResourceLedger;
  const extractionKind = resolveContractExtractionKind(incursion);
  const routingState = buildPostRunRoutingDebriefState({
    ledger,
    contract: incursion.activeContract,
    operationObjectiveKind: context.activeOperation.objectiveKind,
    operationTargetResourceNames: context.activeOperation.rewardEmphasis.targetResources,
    operationId: context.activeOperation.id,
    contractProgress: incursion.contractRunProgress,
    extractionKind,
  });

  const contractResult: ContractResult = routingState.requiresRouting
    ? resolveContractPendingDelivery({
      contract: incursion.activeContract,
      ledger,
      progress: incursion.contractRunProgress,
      extractionKind,
    })
    : resolveContractResult({
      contract: incursion.activeContract,
      ledger,
      progress: incursion.contractRunProgress,
      extractedSuccessfully: true,
      extractionKind,
    });

  const payload = buildOperationDebriefPayload(
    { ...incursion, runResourceLedger: ledger },
    {
      progressBefore: context.activeOperation.progressCurrent,
      progressAfter: context.activeOperation.progressCurrent,
      progressRequired: context.activeOperation.progressRequired,
      completed: false,
      completionLogLines: [],
      credits: 120,
      riftIron: 3,
      residueVaulted: 0,
      extractedSuccessfully: true,
      contractResult,
      extractionKind,
      routingState,
      deferredWorldTick: routingState.requiresRouting,
      runResourceLedger: ledger,
    },
  );

  if (!payload) return 'POST-RUN DEBRIEF PREVIEW — failed to build payload.';

  return [
    'POST-RUN DEBRIEF PREVIEW',
    `outcome: ${payload.runOutcome}`,
    `requires routing: ${payload.routingState?.requiresRouting ? 'yes' : 'no'}`,
    `contract: ${payload.contractResult.status} — ${payload.contractResult.progressText}`,
    `pending items: ${payload.routingState?.pendingItems.length ?? 0}`,
    `auto-stashed: ${formatAutoStashedSummary(payload.routingState?.autoStashed ?? {})}`,
    `deferred world tick: ${payload.deferredWorldTick ? 'yes' : 'no'}`,
    '',
    formatCargoRoutingDebriefPreview({ ...incursion, runResourceLedger: ledger }),
  ].join('\n');
}

export function buildDevRoutingDebriefLaunchPayload(
  incursion: ActiveIncursionState,
  runContext: RunGenerationContext,
  resources: ResourceQuantity = POST_RUN_ROUTING_TEST_LEDGER,
) {
  const ledger = mergeTestResourcesIntoLedger(incursion.runResourceLedger, resources);
  const incWithLedger = {
    ...incursion,
    runGenerationContext: runContext,
    runResourceLedger: ledger,
  };
  const extractionKind = resolveContractExtractionKind(incWithLedger);
  const routingState = buildPostRunRoutingDebriefState({
    ledger,
    contract: incursion.activeContract,
    operationObjectiveKind: runContext.activeOperation.objectiveKind,
    operationTargetResourceNames: runContext.activeOperation.rewardEmphasis.targetResources,
    operationId: runContext.activeOperation.id,
    contractProgress: incursion.contractRunProgress ?? createEmptyContractRunProgress(),
    extractionKind,
  });
  const contractResult = resolveContractPendingDelivery({
    contract: incursion.activeContract,
    ledger,
    progress: incursion.contractRunProgress ?? createEmptyContractRunProgress(),
    extractionKind,
  });

  return buildOperationDebriefPayload(incWithLedger, {
    progressBefore: runContext.activeOperation.progressCurrent,
    progressAfter: runContext.activeOperation.progressCurrent,
    progressRequired: runContext.activeOperation.progressRequired,
    completed: false,
    completionLogLines: [],
    credits: 150,
    riftIron: 4,
    residueVaulted: 0,
    extractedSuccessfully: true,
    contractResult,
    extractionKind,
    routingState,
    deferredWorldTick: true,
    runResourceLedger: ledger,
  });
}

export function buildMinimalDevIncursion(
  runContext: RunGenerationContext,
): ActiveIncursionState {
  return {
    ...createDefaultActiveIncursionState(),
    runGenerationContext: runContext,
    runResourceLedger: buildMockRoutingLedger({}),
    echoRunState: createDefaultEchoRunState(),
    cargoRoutingRunState: createDefaultCargoRoutingRunState(),
  };
}
