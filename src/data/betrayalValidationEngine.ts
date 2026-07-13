import type { BribeOffer } from '../types/betrayal';
import type { ActiveRunContract } from '../types/contract';
import type { CargoRoutingDecision, CargoRoutingResult, RoutableCargoItem } from '../types/postRunCargoRouting';
import type { ResourceItemId } from '../types/resourceItem';
import { isBribeEligibleResource, isTrackedContractCargo } from './bribeOfferEngine';
import { isContractTargetResource } from './postRunCargoRoutingEngine';

export interface BetrayalValidationIssue {
  severity: 'error' | 'warn';
  message: string;
  resourceId?: ResourceItemId;
}

export function validateBribeOfferIntegrity(
  item: RoutableCargoItem,
  contract: ActiveRunContract | null,
): BetrayalValidationIssue[] {
  const issues: BetrayalValidationIssue[] = [];
  const offer = item.bribeOffer;

  if (!offer) return issues;

  if (!contract?.contractId) {
    issues.push({
      severity: 'error',
      message: 'Bribe offer generated without active contract.',
      resourceId: item.resourceId,
    });
  }

  if (!isBribeEligibleCargo(item.resourceId)) {
    issues.push({
      severity: 'error',
      message: 'Bribe offer generated for non-eligible cargo.',
      resourceId: item.resourceId,
    });
  }

  if (contract?.sponsorId && offer.rivalSponsorId === contract.sponsorId) {
    issues.push({
      severity: 'error',
      message: 'Rival sponsor equals original sponsor.',
      resourceId: item.resourceId,
    });
  }

  if (offer.credits <= 0 && offer.reputationGain <= 0 && offer.resourceBonusIds.length === 0) {
    issues.push({
      severity: 'error',
      message: 'Bribe reward missing.',
      resourceId: item.resourceId,
    });
  }

  return issues;
}

function isBribeEligibleCargo(resourceId: ResourceItemId): boolean {
  return isBribeEligibleResource(resourceId);
}

export function validateBetrayalRoutingOutcome({
  items,
  decisions,
  result,
  contract,
  contractBetrayed,
  contractCompletedAfterBetrayal,
}: {
  items: RoutableCargoItem[];
  decisions: CargoRoutingDecision[];
  result: CargoRoutingResult;
  contract: ActiveRunContract | null;
  contractBetrayed: boolean;
  contractCompletedAfterBetrayal: boolean;
}): BetrayalValidationIssue[] {
  const issues: BetrayalValidationIssue[] = [];

  items.forEach((item) => {
    issues.push(...validateBribeOfferIntegrity(item, contract));
  });

  if (contractBetrayed && contractCompletedAfterBetrayal) {
    issues.push({
      severity: 'error',
      message: 'Contract completes after cargo was sold to rival/black market.',
    });
  }

  items.forEach((item) => {
    const decision = decisions.find((entry) => entry.resourceId === item.resourceId);
    if (!decision) return;

    const qty = decision.quantity;
    const inDelivered = (result.delivered[item.resourceId] ?? 0)
      + Object.values(result.deliveredToRival).reduce(
        (sum, bucket) => sum + (bucket?.[item.resourceId] ?? 0),
        0,
      )
      + (result.fenced[item.resourceId] ?? 0)
      + (result.contributed[item.resourceId] ?? 0)
      + (result.kept[item.resourceId] ?? 0)
      + (result.opened[item.resourceId] ?? 0);

    if (inDelivered < qty) {
      issues.push({
        severity: 'error',
        message: 'Routed item quantity does not match final destinations.',
        resourceId: item.resourceId,
      });
    }

    if (decision.action === 'DELIVER_RIVAL_SPONSOR') {
      const rivalId = item.bribeOffer?.rivalSponsorId;
      const rivalQty = rivalId ? result.deliveredToRival[rivalId]?.[item.resourceId] : undefined;
      if (!rivalQty) {
        issues.push({
          severity: 'error',
          message: 'Rival-delivered cargo was not removed from player inventory.',
          resourceId: item.resourceId,
        });
      }
    }

    if (decision.action === 'SELL_FENCE' && !(result.fenced[item.resourceId])) {
      issues.push({
        severity: 'error',
        message: 'Sold cargo was not removed.',
        resourceId: item.resourceId,
      });
    }

    if (decision.action === 'CONTRIBUTE_OPERATION' && !(result.contributed[item.resourceId])) {
      issues.push({
        severity: 'error',
        message: 'Operation-contributed cargo was not removed.',
        resourceId: item.resourceId,
      });
    }
  });

  return issues;
}

export function validateTrackedContractCargoFlags(items: RoutableCargoItem[]): BetrayalValidationIssue[] {
  return items.flatMap((item) => {
    if (!item.isContractTarget) return [];
    const expected = isTrackedContractCargo(item.resourceId, null);
    if (item.trackedContractCargo !== expected && !item.trackedContractCargo) {
      return [{
        severity: 'warn',
        message: 'Tracked contract cargo flag may be incorrect.',
        resourceId: item.resourceId,
      }];
    }
    return [];
  });
}

export function formatBetrayalValidationReport(issues: BetrayalValidationIssue[]): string {
  if (issues.length === 0) return 'BETRAYAL VALIDATION — pass';
  return [
    'BETRAYAL VALIDATION',
    ...issues.map((issue) => `[${issue.severity.toUpperCase()}] ${issue.message}${issue.resourceId ? ` (${issue.resourceId})` : ''}`),
  ].join('\n');
}

export function summarizeBribeOffer(offer: BribeOffer): string {
  return `${offer.rivalSponsorId}: +${offer.credits} CR, +${offer.reputationGain} REP`;
}
