import type { ActiveIncursionState } from '../types/game';
import type { ResourceItemId } from '../types/resourceItem';
import type { CargoRoutingAction } from '../types/postRunCargoRouting';
import { formatBetrayalHistorySnapshot } from './betrayalConsequencesEngine';
import { formatBetrayalValidationReport, validateBribeOfferIntegrity } from './betrayalValidationEngine';
import {
  setDebugForceBribeOffer,
  setDebugForceRivalSponsor,
  isDebugForceBribeOffer,
} from './bribeOfferEngine';
import {
  buildPostRunRoutingDebriefState,
  formatAutoStashedSummary,
} from './postRunCargoRoutingEngine';
import { simulatePostRunRoutingResult } from './postRunCargoRoutingDebugEngine';
import { resolveContractExtractionKind } from './contractExtractionKind';
import type { CabalEmployerId } from '../types/worldState';
import type { PlayerAccount } from '../types/game';

export function debugForceBribeOfferOnNextRouting(enabled = true): void {
  setDebugForceBribeOffer(enabled);
}

export function debugForceRivalSponsor(sponsorId: CabalEmployerId | null): void {
  setDebugForceRivalSponsor(sponsorId);
}

export function debugPreviewBribeOffers(incursion: ActiveIncursionState): string {
  const context = incursion.runGenerationContext;
  if (!context) return 'BRIBE PREVIEW — no run generation context.';

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
    'BRIBE OFFER PREVIEW',
    `force bribe: ${isDebugForceBribeOffer() ? 'ON' : 'OFF'}`,
    `pending items: ${routingState.pendingItems.length}`,
  ];

  routingState.pendingItems.forEach((item) => {
    lines.push(
      `- ${item.resourceId} contract=${item.isContractTarget} tracked=${item.trackedContractCargo} offer=${item.bribeOffer ? `${item.bribeOffer.rivalSponsorId} +${item.bribeOffer.credits} CR` : 'none'}`,
    );
    validateBribeOfferIntegrity(item, routingState.activeContract).forEach((issue) => {
      lines.push(`  ! ${issue.message}`);
    });
  });

  return lines.join('\n');
}

export function debugSimulateRivalDelivery(
  incursion: ActiveIncursionState,
  resourceId: ResourceItemId,
): string {
  setDebugForceBribeOffer(true);
  const report = simulatePostRunRoutingResult(incursion, { [resourceId]: 'DELIVER_RIVAL_SPONSOR' });
  setDebugForceBribeOffer(false);
  return report;
}

export function debugSimulateBetrayalFence(
  incursion: ActiveIncursionState,
  resourceId: ResourceItemId,
): string {
  return simulatePostRunRoutingResult(incursion, { [resourceId]: 'SELL_FENCE' });
}

export function debugSimulateKeepContractCargo(
  incursion: ActiveIncursionState,
  resourceId: ResourceItemId,
): string {
  return simulatePostRunRoutingResult(incursion, { [resourceId]: 'KEEP_STASH' });
}

export function debugSimulateContributeContractCargo(
  incursion: ActiveIncursionState,
  resourceId: ResourceItemId,
): string {
  return simulatePostRunRoutingResult(incursion, { [resourceId]: 'CONTRIBUTE_OPERATION' });
}

export function debugPrintBetrayalAccountSnapshot(account: PlayerAccount): string {
  return [
    formatBetrayalHistorySnapshot(account.betrayalHistory),
    `Career betrayals: ${account.careerCargoRouting.contractsBetrayed ?? 0}`,
    `Career rival deliveries: ${account.careerCargoRouting.deliveredToRival ?? 0}`,
  ].join('\n');
}

export function debugValidateBetrayalOffers(incursion: ActiveIncursionState): string {
  const context = incursion.runGenerationContext;
  if (!context) return 'BETRAYAL VALIDATION — no run generation context.';

  const routingState = buildPostRunRoutingDebriefState({
    ledger: incursion.runResourceLedger,
    contract: incursion.activeContract,
    operationObjectiveKind: context.activeOperation.objectiveKind,
    operationTargetResourceNames: context.activeOperation.rewardEmphasis.targetResources,
    operationId: context.activeOperation.id,
    contractProgress: incursion.contractRunProgress,
    extractionKind: resolveContractExtractionKind(incursion),
  });

  const issues = routingState.pendingItems.flatMap((item) => (
    validateBribeOfferIntegrity(item, routingState.activeContract)
  ));

  return formatBetrayalValidationReport(issues);
}

export function debugPrintRoutingBribeSummary(incursion: ActiveIncursionState): string {
  const preview = debugPreviewBribeOffers(incursion);
  const auto = incursion.runGenerationContext
    ? formatAutoStashedSummary(buildPostRunRoutingDebriefState({
      ledger: incursion.runResourceLedger,
      contract: incursion.activeContract,
      operationObjectiveKind: incursion.runGenerationContext.activeOperation.objectiveKind,
      operationTargetResourceNames: incursion.runGenerationContext.activeOperation.rewardEmphasis.targetResources,
      operationId: incursion.runGenerationContext.activeOperation.id,
      contractProgress: incursion.contractRunProgress,
      extractionKind: resolveContractExtractionKind(incursion),
    }).autoStashed)
    : 'n/a';
  return `${preview}\nAUTO-STASHED: ${auto}`;
}
