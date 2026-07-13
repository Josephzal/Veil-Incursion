import type {
  BetrayalDestination,
  BetrayalEvent,
  BetrayalSeverity,
  ContractOutcomeKind,
} from '../types/betrayal';
import type {
  ActiveRunContract,
  ContractExtractionKind,
  ContractResult,
  ContractRunProgress,
} from '../types/contract';
import type {
  CargoRoutingDecision,
  CargoRoutingResult,
  PostRunRoutingDebriefState,
  RoutableCargoItem,
} from '../types/postRunCargoRouting';
import type { ClassType } from '../types/game';
import type { RunResourceLedger } from '../types/runResourceLedger';
import {
  outcomeKindLabel,
  resolveActionBetrayalPreview,
  severityRank,
} from './bribeOfferEngine';
import {
  isResourceContractObjective,
  resolveContractAfterRouting,
} from './contractResolver';
import { applyKeepsakeDeliveredQuantityBonus } from './expeditionKeepsakeCargoEngine';
import type { KeepsakeRuntime } from '../types/expeditionKeepsake';
import { getResourceDisplayName } from './resourceRegistry';
import { sponsorDisplayName } from '../utils/contractUi';
import type { CabalEmployerId } from '../types/worldState';

export interface BetrayalResolutionContext {
  runId?: string;
  playerClass?: ClassType;
  depthReached?: number;
}

function emptyBetrayalFields(): Pick<
  ContractResult,
  | 'outcomeKind'
  | 'betrayalSeverity'
  | 'finalCargoDestination'
  | 'originalSponsorRepDelta'
  | 'rivalSponsorId'
  | 'rivalSponsorRepDelta'
  | 'betrayalSummary'
> {
  return {
    outcomeKind: undefined,
    betrayalSeverity: 'NONE',
    finalCargoDestination: undefined,
    originalSponsorRepDelta: 0,
    rivalSponsorId: null,
    rivalSponsorRepDelta: 0,
    betrayalSummary: null,
  };
}

function mergeBetrayalIntoResult(
  base: ContractResult,
  fields: ReturnType<typeof emptyBetrayalFields>,
): ContractResult {
  return { ...base, ...fields };
}

function resolveContractTargetDecisions(
  items: RoutableCargoItem[],
  decisions: CargoRoutingDecision[],
): Array<{
  resourceId: RoutableCargoItem['resourceId'];
  action: CargoRoutingDecision['action'];
  quantity: number;
  preview: ReturnType<typeof resolveActionBetrayalPreview>;
  bribeOffer: RoutableCargoItem['bribeOffer'];
}> {
  return items
    .filter((item) => item.isContractTarget)
    .map((item) => {
      const decision = decisions.find((entry) => entry.resourceId === item.resourceId);
      const action = decision?.action ?? item.recommendedAction;
      const quantity = decision?.quantity ?? item.quantity;
      return {
        resourceId: item.resourceId,
        action,
        quantity,
        bribeOffer: item.bribeOffer,
        preview: resolveActionBetrayalPreview({
          action,
          resourceId: item.resourceId,
          contract: null,
          bribeOffer: item.bribeOffer,
          routedQuantity: quantity,
        }),
      };
    });
}

function resolveDominantContractOutcome(
  contract: ActiveRunContract,
  targetDecisions: ReturnType<typeof resolveContractTargetDecisions>,
): {
  outcomeKind: ContractOutcomeKind;
  severity: BetrayalSeverity;
  finalDestination: string;
  rivalSponsorId: CabalEmployerId | null;
  originalRepDelta: number;
  rivalRepDelta: number;
} {
  const allDelivered = targetDecisions.length > 0
    && targetDecisions.every((entry) => entry.action === 'DELIVER_SPONSOR');

  if (allDelivered) {
    return {
      outcomeKind: 'COMPLETE',
      severity: 'NONE',
      finalDestination: sponsorDisplayName(contract.sponsorId ?? ''),
      rivalSponsorId: null,
      originalRepDelta: 0,
      rivalRepDelta: 0,
    };
  }

  let dominant = targetDecisions[0];
  targetDecisions.forEach((entry) => {
    const preview = resolveActionBetrayalPreview({
      action: entry.action,
      resourceId: entry.resourceId,
      contract,
      bribeOffer: entry.bribeOffer,
      routedQuantity: entry.quantity,
    });
    const currentPreview = resolveActionBetrayalPreview({
      action: dominant.action,
      resourceId: dominant.resourceId,
      contract,
      bribeOffer: dominant.bribeOffer,
      routedQuantity: dominant.quantity,
    });
    if (severityRank(preview.severity) > severityRank(currentPreview.severity)) {
      dominant = entry;
    }
  });

  const preview = resolveActionBetrayalPreview({
    action: dominant.action,
    resourceId: dominant.resourceId,
    contract,
    bribeOffer: dominant.bribeOffer,
    routedQuantity: dominant.quantity,
  });

  let finalDestination = 'Personal stash';
  let rivalSponsorId: CabalEmployerId | null = null;

  switch (preview.outcomeKind) {
    case 'BETRAYED_TO_RIVAL':
      rivalSponsorId = dominant.bribeOffer?.rivalSponsorId ?? null;
      finalDestination = rivalSponsorId ? sponsorDisplayName(rivalSponsorId) : 'Rival sponsor';
      break;
    case 'FENCED_TO_BLACK_MARKET':
      finalDestination = 'Black Market';
      break;
    case 'CONTRIBUTED_TO_OPERATION':
      finalDestination = 'Sector operation';
      break;
    case 'KEPT_BY_PLAYER':
      finalDestination = 'Personal stash';
      break;
    default:
      finalDestination = 'Undelivered';
      break;
  }

  const mixed = targetDecisions.some((entry) => entry.action === 'DELIVER_SPONSOR')
    && targetDecisions.some((entry) => entry.action !== 'DELIVER_SPONSOR');

  return {
    outcomeKind: mixed ? 'PARTIAL' : preview.outcomeKind,
    severity: preview.severity,
    finalDestination,
    rivalSponsorId,
    originalRepDelta: preview.originalSponsorRepDelta,
    rivalRepDelta: preview.rivalSponsorRepDelta,
  };
}

function buildBetrayalSummary(
  contract: ActiveRunContract,
  outcomeKind: ContractOutcomeKind,
  finalDestination: string,
  originalRepDelta: number,
  rivalSponsorId: CabalEmployerId | null,
  rivalRepDelta: number,
): string | null {
  if (outcomeKind === 'COMPLETE') return null;

  const lines = [
    outcomeKindLabel(outcomeKind),
    `Original Sponsor: ${sponsorDisplayName(contract.sponsorId ?? '')}`,
    `Cargo Destination: ${finalDestination}`,
  ];

  if (originalRepDelta < 0) {
    lines.push(`${sponsorDisplayName(contract.sponsorId ?? '')} Reputation ${originalRepDelta}`);
  }
  if (rivalSponsorId && rivalRepDelta > 0) {
    lines.push(`${sponsorDisplayName(rivalSponsorId)} Reputation +${rivalRepDelta}`);
  }

  return lines.join(' // ');
}

function buildProgressText(
  contract: ActiveRunContract,
  outcomeKind: ContractOutcomeKind,
  finalDestination: string,
  targetDecisions: ReturnType<typeof resolveContractTargetDecisions>,
): string {
  const cargoLabel = targetDecisions.length === 1
    ? getResourceDisplayName(targetDecisions[0].resourceId, true)
    : 'contract cargo';

  switch (outcomeKind) {
    case 'COMPLETE':
      return `Contract honored. ${cargoLabel} delivered to ${sponsorDisplayName(contract.sponsorId ?? '')}.`;
    case 'BETRAYED_TO_RIVAL':
      return `Contract betrayed. ${cargoLabel} delivered to ${finalDestination} instead.`;
    case 'FENCED_TO_BLACK_MARKET':
      return `Contract betrayed. ${cargoLabel} sold through the Black Market.`;
    case 'KEPT_BY_PLAYER':
      return `Contract failed. ${cargoLabel} retained in personal stash.`;
    case 'CONTRIBUTED_TO_OPERATION':
      return `Contract redirected. ${cargoLabel} contributed to sector operation.`;
    case 'PARTIAL':
      return `Contract partially failed. Not all ${cargoLabel} reached ${sponsorDisplayName(contract.sponsorId ?? '')}.`;
    default:
      return `Contract failed. ${cargoLabel} not delivered to sponsor.`;
  }
}

export function buildBetrayalEventsFromRouting({
  items,
  decisions,
  routingResult,
  contract,
  context,
}: {
  items: RoutableCargoItem[];
  decisions: CargoRoutingDecision[];
  routingResult: CargoRoutingResult;
  contract: ActiveRunContract;
  context: BetrayalResolutionContext;
}): BetrayalEvent[] {
  const events: BetrayalEvent[] = [];
  const timestamp = Date.now();
  const runId = context.runId ?? `run-${timestamp}`;
  const playerClass = context.playerClass ?? 'AEGIS';
  const depthReached = context.depthReached ?? 1;

  items.filter((item) => item.isContractTarget).forEach((item) => {
    const decision = decisions.find((entry) => entry.resourceId === item.resourceId);
    const action = decision?.action ?? item.recommendedAction;
    const preview = resolveActionBetrayalPreview({
      action,
      resourceId: item.resourceId,
      contract,
      bribeOffer: item.bribeOffer,
      routedQuantity: decision?.quantity ?? item.quantity,
    });

    if (preview.severity === 'NONE') return;

    let receivingDestination: BetrayalDestination = 'SELF';
    let receivingSponsorId: CabalEmployerId | null = null;

    switch (action) {
      case 'DELIVER_RIVAL_SPONSOR':
        receivingDestination = item.bribeOffer?.rivalSponsorId ?? 'SELF';
        receivingSponsorId = item.bribeOffer?.rivalSponsorId ?? null;
        break;
      case 'SELL_FENCE':
        receivingDestination = 'BLACK_MARKET';
        break;
      case 'CONTRIBUTE_OPERATION':
        receivingDestination = 'OPERATION';
        break;
      default:
        receivingDestination = 'SELF';
        break;
    }

    events.push({
      runId,
      betrayedSponsorId: contract.sponsorId!,
      receivingDestination,
      receivingSponsorId,
      cargoId: item.resourceId,
      quantity: decision?.quantity ?? item.quantity,
      severity: preview.severity,
      depthReached,
      playerClass,
      canGenerateBetrayerEchoLater: preview.severity === 'HARD_BETRAYAL',
      timestamp,
    });
  });

  if (events.length === 0 && routingResult.deliveredToRival) {
    Object.entries(routingResult.deliveredToRival).forEach(([sponsorId, quantities]) => {
      Object.entries(quantities).forEach(([resourceId, quantity]) => {
        if (!quantity || quantity <= 0) return;
        events.push({
          runId,
          betrayedSponsorId: contract.sponsorId!,
          receivingDestination: sponsorId as CabalEmployerId,
          receivingSponsorId: sponsorId as CabalEmployerId,
          cargoId: resourceId as RoutableCargoItem['resourceId'],
          quantity,
          severity: 'HARD_BETRAYAL',
          depthReached,
          playerClass,
          canGenerateBetrayerEchoLater: true,
          timestamp,
        });
      });
    });
  }

  return events;
}

export function resolveContractAfterBetrayalRouting({
  routingState,
  routingResult,
  decisions,
  items,
  extractedSuccessfully,
  ledger,
  keepsakeRuntime,
}: {
  routingState: PostRunRoutingDebriefState;
  routingResult: CargoRoutingResult | null;
  decisions: CargoRoutingDecision[];
  items: RoutableCargoItem[];
  extractedSuccessfully: boolean;
  ledger?: RunResourceLedger;
  keepsakeRuntime?: KeepsakeRuntime | null;
}): ContractResult {
  const contract = routingState.activeContract;
  const betrayalFields = emptyBetrayalFields();

  if (!contract?.contractId || !contract.objectiveKind) {
    return resolveContractAfterRouting({
      contract,
      progress: routingState.contractProgress,
      deliveredResources: {},
      extractedSuccessfully,
      extractionKind: routingState.extractionKind,
      skipResourceDelivery: true,
    });
  }

  const contractTargets = items.filter((item) => item.isContractTarget);
  const hasRoutingApplied = Boolean(routingResult);

  if (
    !hasRoutingApplied
    && routingState.initialContractPendingDelivery
    && isResourceContractObjective(contract.objectiveKind)
  ) {
    const base = resolveContractAfterRouting({
      contract,
      progress: routingState.contractProgress,
      deliveredResources: {},
      extractedSuccessfully,
      extractionKind: routingState.extractionKind,
      skipResourceDelivery: true,
      ledger,
    });
    return mergeBetrayalIntoResult(base, {
      ...betrayalFields,
      outcomeKind: 'FAILED',
    });
  }

  if (!hasRoutingApplied || contractTargets.length === 0) {
    const delivered = applyKeepsakeDeliveredQuantityBonus(
      routingResult?.deliveredResourcesForContract ?? {},
      keepsakeRuntime,
    );
    return resolveContractAfterRouting({
      contract,
      progress: routingState.contractProgress,
      deliveredResources: delivered,
      extractedSuccessfully,
      extractionKind: routingState.extractionKind,
      skipResourceDelivery: !routingState.initialContractPendingDelivery && contractTargets.length === 0,
      ledger,
    });
  }

  const targetDecisions = resolveContractTargetDecisions(items, decisions);
  const dominant = resolveDominantContractOutcome(contract, targetDecisions);

  const delivered = applyKeepsakeDeliveredQuantityBonus(
    routingResult!.deliveredResourcesForContract,
    keepsakeRuntime,
  );

  const base = resolveContractAfterRouting({
    contract,
    progress: routingState.contractProgress,
    deliveredResources: delivered,
    extractedSuccessfully,
    extractionKind: routingState.extractionKind,
    ledger,
  });

  const succeeded = dominant.outcomeKind === 'COMPLETE';
  const progressText = buildProgressText(
    contract,
    dominant.outcomeKind,
    dominant.finalDestination,
    targetDecisions,
  );

  const betrayalSummary = buildBetrayalSummary(
    contract,
    dominant.outcomeKind,
    dominant.finalDestination,
    dominant.originalRepDelta,
    dominant.rivalSponsorId,
    dominant.rivalRepDelta,
  );

  return mergeBetrayalIntoResult(
    {
      ...base,
      status: succeeded ? 'SUCCESS' : 'FAILED',
      progressText,
      reputationAwarded: succeeded ? base.reputationAwarded : 0,
      creditsAwarded: succeeded ? base.creditsAwarded : 0,
      resourceBonusIds: succeeded ? base.resourceBonusIds : [],
      bonusCreditsAwarded: succeeded ? base.bonusCreditsAwarded : 0,
      bonusReputationAwarded: succeeded ? base.bonusReputationAwarded : 0,
    },
    {
      outcomeKind: dominant.outcomeKind,
      betrayalSeverity: dominant.severity,
      finalCargoDestination: dominant.finalDestination,
      originalSponsorRepDelta: dominant.originalRepDelta,
      rivalSponsorId: dominant.rivalSponsorId,
      rivalSponsorRepDelta: dominant.rivalRepDelta,
      betrayalSummary,
    },
  );
}
