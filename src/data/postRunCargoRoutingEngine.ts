import type {
  ActiveRunContract,
  ContractExtractionKind,
  ContractObjectiveKind,
  ContractResult,
  ContractRunProgress,
} from '../types/contract';
import type {
  CargoRoutingAction,
  CargoRoutingContext,
  CargoRoutingDecision,
  CargoRoutingOutcomeLine,
  CargoRoutingResult,
  PostRunCargoSplit,
  PostRunRoutingDebriefState,
  RoutableCargoItem,
  RoutableCargoSource,
} from '../types/postRunCargoRouting';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import type { RunResourceLedger } from '../types/runResourceLedger';
import { createEmptyRunResourceLedger } from '../types/runResourceLedger';
import type { CabalEmployerId, OperationObjectiveKind } from '../types/worldState';
import { sponsorDisplayName } from '../utils/contractUi';
import {
  isResourceContractObjective,
  resolveContractAfterRouting,
  resolveContractPendingDelivery,
  resolveContractResult,
} from './contractResolver';
import { resolveContractAfterBetrayalRouting } from './contractBetrayalResolver';
import {
  isTrackedContractCargo,
  maybeGenerateBribeOffer,
  resolveActionBetrayalPreview,
} from './bribeOfferEngine';
import { creditFenceSale } from './hubSafehouseEngine';
import { resolveContributionRules } from './operationRulesEngine';
import { isRouteIntelResource } from './sectorAccessMandateEngine';
import {
  ALL_RESOURCE_ITEM_IDS,
  canResourceBeSoldToFence,
  getResourceCategory,
  getResourceDisplayName,
  isFenceableResourceId,
  RESOURCE_REGISTRY,
} from './resourceRegistry';
import { resolveFenceUnitValue } from './economyValueLaneEngine';
import { addToResourceStash } from './resourceStashEngine';
import { rollSealedContainerOpenReward } from './sealedContainerOpenEngine';
import {
  getAppraisalBandLabel,
  getSealedAppraisalFee,
  resolveOpeningFee,
  resolveSealedSellValue,
  rollAppraisalValueBand,
} from './sealedCasketAppraisalEngine';
import {
  buildSealedCargoItemKey,
  formatSealedCargoWarning,
  isAppraisableSealedResource,
} from './sealedCargoEngine';
import type { AppraisalValueBand, SealedCargoState } from '../types/sealedCargo';
import { mergeResourceQuantities } from './runResourceLedgerEngine';
import { OPERATION_CONTRIBUTION_VALUES } from './worldStateHelpers';
import { applyKeepsakeDeliveredQuantityBonus, resolveKeepsakeFenceValueMultiplier } from './expeditionKeepsakeCargoEngine';
import type { KeepsakeRuntime } from '../types/expeditionKeepsake';

function normalizeResourceLabel(label: string): string {
  return label.toLowerCase().replace(/[\s-]/g, '');
}

function resolveTargetResourceIds(targetNames: string[] | undefined): ResourceItemId[] {
  if (!targetNames || targetNames.length === 0) return [];
  const normalizedTargets = new Set(targetNames.map(normalizeResourceLabel));
  return ALL_RESOURCE_ITEM_IDS.filter((id) => {
    const def = RESOURCE_REGISTRY[id];
    return normalizedTargets.has(normalizeResourceLabel(def.name))
      || normalizedTargets.has(normalizeResourceLabel(def.shortName));
  });
}

export function buildCargoRoutingContext(
  contract: ActiveRunContract | null,
  operationObjectiveKind: OperationObjectiveKind | null,
  operationTargetResourceNames: string[] | undefined,
): CargoRoutingContext {
  const rules = operationObjectiveKind
    ? resolveContributionRules(operationObjectiveKind)
    : null;
  return {
    contract,
    operationObjectiveKind,
    operationTargetResourceNames,
    operationAcceptsTargetResources: Boolean(rules?.extractTargetResource),
  };
}

export function isContractTargetResource(
  resourceId: ResourceItemId,
  contract: ActiveRunContract | null,
): boolean {
  if (!contract?.objectiveKind || !isResourceContractObjective(contract.objectiveKind)) {
    return false;
  }
  if (contract.targetResourceId === resourceId) return true;
  if (contract.targetResourceOptions?.includes(resourceId)) return true;
  if (contract.targetCategory && getResourceCategory(resourceId) === contract.targetCategory) {
    return true;
  }
  return false;
}

export function isOperationTargetResource(
  resourceId: ResourceItemId,
  ctx: CargoRoutingContext,
): boolean {
  if (!ctx.operationAcceptsTargetResources) return false;
  if (!RESOURCE_REGISTRY[resourceId].canBeOperationTarget) return false;
  const targetIds = resolveTargetResourceIds(ctx.operationTargetResourceNames);
  return targetIds.includes(resourceId);
}

export function requiresPostRunRouting(
  resourceId: ResourceItemId,
  quantity: number,
  ctx: CargoRoutingContext,
): boolean {
  if (quantity <= 0) return false;
  if (isContractTargetResource(resourceId, ctx.contract)) return true;
  if (isOperationTargetResource(resourceId, ctx)) return true;
  return getResourceCategory(resourceId) !== 'STABLE';
}

function resolveSource(
  resourceId: ResourceItemId,
  ledger: RunResourceLedger,
): RoutableCargoSource {
  const banked = ledger.bankedAtSafehouse[resourceId] ?? 0;
  const extracted = ledger.extracted[resourceId] ?? 0;
  return banked >= extracted ? 'BANKED' : 'EXTRACTED';
}

function buildValidActions(
  resourceId: ResourceItemId,
  ctx: CargoRoutingContext,
  bribeOffer: import('../types/betrayal').BribeOffer | null,
): Pick<
  RoutableCargoItem,
  | 'canFence'
  | 'canKeep'
  | 'canDeliver'
  | 'canDeliverRival'
  | 'canContribute'
  | 'canOpenAtHub'
  | 'openAtHubEnabled'
  | 'validActions'
> {
  const def = RESOURCE_REGISTRY[resourceId];
  const canFence = canResourceBeSoldToFence(resourceId);
  const canDeliver = isContractTargetResource(resourceId, ctx.contract)
    && Boolean(ctx.contract?.sponsorId);
  const canDeliverRival = Boolean(bribeOffer);
  const canContribute = isOperationTargetResource(resourceId, ctx);
  const canOpenAtHub = def.canOpenAtHub;
  const openAtHubEnabled = isAppraisableSealedResource(resourceId) && def.canOpenAtHub;

  const validActions: CargoRoutingAction[] = ['KEEP_STASH'];
  if (canDeliver) validActions.push('DELIVER_SPONSOR');
  if (canDeliverRival) validActions.push('DELIVER_RIVAL_SPONSOR');
  // Phase 1I — route intel must never be fenceable (anti-frustration).
  if (canFence && !isRouteIntelResource(resourceId)) validActions.push('SELL_FENCE');
  if (canContribute) validActions.push('CONTRIBUTE_OPERATION');
  if (canOpenAtHub) {
    validActions.push('OPEN_SEALED');
    validActions.push('OPEN_AT_HUB');
  }

  return {
    canFence,
    canKeep: true,
    canDeliver,
    canDeliverRival,
    canContribute,
    canOpenAtHub,
    openAtHubEnabled,
    validActions,
  };
}

export function recommendCargoRoutingAction(
  resourceId: ResourceItemId,
  ctx: CargoRoutingContext,
  validActions: CargoRoutingAction[],
): CargoRoutingAction {
  if (isRouteIntelResource(resourceId) && validActions.includes('KEEP_STASH')) {
    return 'KEEP_STASH';
  }
  if (validActions.includes('DELIVER_SPONSOR') && isContractTargetResource(resourceId, ctx.contract)) {
    return 'DELIVER_SPONSOR';
  }
  if (validActions.includes('CONTRIBUTE_OPERATION') && isOperationTargetResource(resourceId, ctx)) {
    return 'CONTRIBUTE_OPERATION';
  }
  if (
    isAppraisableSealedResource(resourceId)
    && (validActions.includes('OPEN_SEALED') || validActions.includes('OPEN_AT_HUB'))
    && !isContractTargetResource(resourceId, ctx.contract)
  ) {
    return 'OPEN_SEALED';
  }
  if (validActions.includes('SELL_FENCE')) {
    const sellValue = resolveFenceUnitValue(resourceId);
    if (sellValue >= 100 || resourceId === 'smugglers-ledger' || resourceId === 'tarnished-dog-tags') {
      return 'SELL_FENCE';
    }
  }
  if (RESOURCE_REGISTRY[resourceId].canBeCraftingIngredient && validActions.includes('KEEP_STASH')) {
    return 'KEEP_STASH';
  }
  if (isAppraisableSealedResource(resourceId) && validActions.includes('KEEP_STASH')) {
    return 'KEEP_STASH';
  }
  if (validActions.includes('SELL_FENCE')) {
    return 'SELL_FENCE';
  }
  return validActions[0] ?? 'KEEP_STASH';
}

export function supportsPartialCargoRouting(item: RoutableCargoItem): boolean {
  if (item.quantity <= 1) return false;
  const def = RESOURCE_REGISTRY[item.resourceId];
  if (def.cargoStackCap <= 1) return false;
  return item.canFence || item.canDeliver || item.canContribute;
}

export function expandRoutingDecisions(
  items: RoutableCargoItem[],
  decisions: CargoRoutingDecision[],
): CargoRoutingDecision[] {
  const expanded: CargoRoutingDecision[] = [];

  items.forEach((item) => {
    const decision = decisions.find((entry) => entry.resourceId === item.resourceId);
    if (!decision) return;

    const routedQty = Math.min(Math.max(1, decision.quantity), item.quantity);
    if (decision.action === 'KEEP_STASH' || routedQty >= item.quantity) {
      expanded.push({ ...decision, quantity: item.quantity });
      return;
    }

    expanded.push({ ...decision, quantity: routedQty });
    const remainder = item.quantity - routedQty;
    if (remainder > 0) {
      expanded.push({
        resourceId: item.resourceId,
        quantity: remainder,
        action: 'KEEP_STASH',
      });
    }
  });

  return expanded;
}

function buildRoutableItem(
  resourceId: ResourceItemId,
  quantity: number,
  source: RoutableCargoSource,
  ctx: CargoRoutingContext,
  bribeOfferSeed: string,
  sealedAppraisalByItemKey: Record<string, { state: SealedCargoState; valueBand?: AppraisalValueBand }> = {},
): RoutableCargoItem {
  const itemKey = isAppraisableSealedResource(resourceId)
    ? buildSealedCargoItemKey(resourceId, source, 0)
    : undefined;
  const sealedMeta = itemKey ? sealedAppraisalByItemKey[itemKey] : undefined;
  const sealedState = sealedMeta?.state ?? (isAppraisableSealedResource(resourceId) ? 'SEALED' : undefined);
  const valueBand = sealedMeta?.valueBand;
  const bribeOffer = maybeGenerateBribeOffer({
    resourceId,
    quantity,
    contract: ctx.contract,
    seed: bribeOfferSeed,
  });
  const actions = buildValidActions(resourceId, ctx, bribeOffer);
  const recommendedAction = recommendCargoRoutingAction(resourceId, ctx, actions.validActions);
  const isContractTarget = isContractTargetResource(resourceId, ctx.contract);
  const isOperationTarget = isOperationTargetResource(resourceId, ctx);
  const trackedContractCargo = isTrackedContractCargo(resourceId, ctx.contract);

  const betrayalPreviewByAction: RoutableCargoItem['betrayalPreviewByAction'] = {};
  actions.validActions.forEach((action) => {
    const normalized = action === 'OPEN_AT_HUB' ? 'OPEN_SEALED' : action;
    betrayalPreviewByAction[action] = resolveActionBetrayalPreview({
      action: normalized,
      resourceId,
      contract: ctx.contract,
      bribeOffer,
      routedQuantity: quantity,
    });
  });

  let contractWarning: string | null = null;
  if (isContractTarget && recommendedAction !== 'DELIVER_SPONSOR') {
    const preview = betrayalPreviewByAction[recommendedAction];
    contractWarning = preview?.warning
      ?? 'Contract will not complete if this item is not delivered to your sponsor.';
  }
  if (isAppraisableSealedResource(resourceId) && isContractTarget) {
    contractWarning = formatSealedCargoWarning(true, 'OPEN')
      ?? contractWarning;
  }

  return {
    resourceId,
    quantity,
    source,
    isContractTarget,
    isOperationTarget,
    recommendedAction,
    contractWarning,
    trackedContractCargo,
    bribeOffer,
    betrayalPreviewByAction,
    sealedItemKey: itemKey,
    sealedState,
    valueBand,
    appraisalFee: isAppraisableSealedResource(resourceId) ? getSealedAppraisalFee(resourceId) : undefined,
    openingFee: isAppraisableSealedResource(resourceId)
      ? resolveOpeningFee(sealedState === 'APPRAISED', resourceId)
      : undefined,
    sealedSellValue: isAppraisableSealedResource(resourceId)
      ? resolveSealedSellValue(sealedState === 'APPRAISED' ? 'APPRAISED' : 'SEALED', valueBand, resourceId)
      : undefined,
    canAppraise: isAppraisableSealedResource(resourceId) && sealedState !== 'APPRAISED',
    ...actions,
  };
}

export function enrichRoutableItemsWithSealedMeta(
  items: RoutableCargoItem[],
  sealedAppraisalByItemKey: Record<string, { state: SealedCargoState; valueBand?: AppraisalValueBand }>,
  ctx: CargoRoutingContext,
  bribeOfferSeed: string,
): RoutableCargoItem[] {
  return items.map((item) => buildRoutableItem(
    item.resourceId,
    item.quantity,
    item.source,
    ctx,
    bribeOfferSeed,
    sealedAppraisalByItemKey,
  ));
}

export function appraiseSealedRoutingItem({
  item,
  cabalCredits,
  sealedAppraisalByItemKey,
}: {
  item: RoutableCargoItem;
  cabalCredits: number;
  sealedAppraisalByItemKey: Record<string, { state: SealedCargoState; valueBand?: AppraisalValueBand }>;
}): {
  ok: boolean;
  error?: string;
  nextCredits: number;
  nextSealedAppraisalByItemKey: Record<string, { state: SealedCargoState; valueBand?: AppraisalValueBand }>;
  result?: import('../types/sealedCargo').CasketAppraisalResult;
} {
  if (!item.sealedItemKey || !item.canAppraise) {
    return { ok: false, error: 'Item cannot be appraised.', nextCredits: cabalCredits, nextSealedAppraisalByItemKey: sealedAppraisalByItemKey };
  }
  const fee = item.appraisalFee ?? getSealedAppraisalFee(item.resourceId);
  if (cabalCredits < fee) {
    return { ok: false, error: `Appraisal requires ${fee} credits.`, nextCredits: cabalCredits, nextSealedAppraisalByItemKey: sealedAppraisalByItemKey };
  }
  const valueBand = rollAppraisalValueBand();
  const nextKey = {
    ...sealedAppraisalByItemKey,
    [item.sealedItemKey]: { state: 'APPRAISED' as const, valueBand },
  };
  return {
    ok: true,
    nextCredits: cabalCredits - fee,
    nextSealedAppraisalByItemKey: nextKey,
    result: {
      resourceId: item.resourceId,
      quantity: item.quantity,
      valueBand,
      displayLabel: getAppraisalBandLabel(valueBand, item.resourceId),
      feePaid: fee,
    },
  };
}

export function splitPostRunCargo(
  ledger: RunResourceLedger,
  ctx: CargoRoutingContext,
  bribeOfferSeed = 'default',
  sealedAppraisalByItemKey: Record<string, { state: SealedCargoState; valueBand?: AppraisalValueBand }> = {},
): PostRunCargoSplit {
  const available = mergeResourceQuantities(ledger.extracted, ledger.bankedAtSafehouse);
  const autoStash: ResourceQuantity = {};
  const pendingItems: RoutableCargoItem[] = [];

  (Object.entries(available) as Array<[ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      const qty = quantity ?? 0;
      if (qty <= 0) return;
      if (requiresPostRunRouting(resourceId, qty, ctx)) {
        pendingItems.push(buildRoutableItem(
          resourceId,
          qty,
          resolveSource(resourceId, ledger),
          ctx,
          bribeOfferSeed,
          sealedAppraisalByItemKey,
        ));
      } else {
        autoStash[resourceId] = qty;
      }
    },
  );

  pendingItems.sort((a, b) => a.resourceId.localeCompare(b.resourceId));
  return { autoStash, pendingItems };
}

export function buildDefaultRoutingDecisions(
  items: RoutableCargoItem[],
): CargoRoutingDecision[] {
  return items.map((item) => ({
    resourceId: item.resourceId,
    quantity: item.quantity,
    action: item.recommendedAction,
    rivalSponsorId: item.bribeOffer?.rivalSponsorId,
  }));
}

export function validateCargoRoutingDecisions(
  items: RoutableCargoItem[],
  decisions: CargoRoutingDecision[],
): string[] {
  const issues: string[] = [];

  items.forEach((item) => {
    const decision = decisions.find((entry) => entry.resourceId === item.resourceId);
    if (!decision) {
      issues.push(`${item.resourceId} requires a routing decision.`);
      return;
    }
    if (!item.validActions.includes(decision.action)) {
      issues.push(`${item.resourceId} cannot be routed via ${decision.action}.`);
    }
    if (isRouteIntelResource(decision.resourceId) && decision.action === 'SELL_FENCE') {
      issues.push(
        `${getResourceDisplayName(decision.resourceId)} is sector access route intel — cannot fence.`,
      );
    }
    if (isRouteIntelResource(decision.resourceId) && decision.action !== 'KEEP_STASH') {
      issues.push(
        `${getResourceDisplayName(decision.resourceId)} is sector access route intel — keep in stash.`,
      );
    }
    const openAction = decision.action === 'OPEN_AT_HUB' || decision.action === 'OPEN_SEALED';
    if (openAction && !item.openAtHubEnabled) {
      issues.push(`${item.resourceId} opening is not available until after extraction.`);
    }
    if (decision.quantity <= 0 || decision.quantity > item.quantity) {
      issues.push(`${item.resourceId} routing quantity must be between 1 and ${item.quantity}.`);
    }
    if (decision.quantity < item.quantity && decision.action === 'KEEP_STASH') {
      issues.push(`${item.resourceId} partial keep is invalid — route a subset to another action.`);
    }
    if (decision.action === 'DELIVER_RIVAL_SPONSOR') {
      if (!item.bribeOffer) {
        issues.push(`${item.resourceId} rival delivery requires a generated bribe offer.`);
      } else if (decision.rivalSponsorId && decision.rivalSponsorId !== item.bribeOffer.rivalSponsorId) {
        issues.push(`${item.resourceId} rival sponsor mismatch.`);
      }
    }
  });

  return issues;
}

function actionLabel(action: CargoRoutingAction): string {
  switch (action) {
    case 'KEEP_STASH':
      return 'Kept in stash';
    case 'DELIVER_SPONSOR':
      return 'Delivered to sponsor';
    case 'DELIVER_RIVAL_SPONSOR':
      return 'Delivered to rival sponsor';
    case 'SELL_FENCE':
      return 'Sold to Black Market';
    case 'CONTRIBUTE_OPERATION':
      return 'Contributed to operation';
    case 'OPEN_SEALED':
    case 'OPEN_AT_HUB':
      return 'Opened / cracked';
    default:
      return action;
  }
}

export function applyCargoRoutingDecisions({
  decisions,
  items,
  autoStashed,
  stash,
  cabalCredits,
  operationContributionPerStack,
  keepsakeRuntime,
  routingContext,
}: {
  decisions: CargoRoutingDecision[];
  items: RoutableCargoItem[];
  autoStashed: ResourceQuantity;
  stash: ResourceQuantity;
  cabalCredits: number;
  operationContributionPerStack: number;
  keepsakeRuntime?: KeepsakeRuntime | null;
  routingContext?: CargoRoutingContext | null;
}): {
  result: CargoRoutingResult;
  stash: ResourceQuantity;
  cabalCredits: number;
} {
  const validationIssues = validateCargoRoutingDecisions(items, decisions);
  if (validationIssues.length > 0) {
    throw new Error(validationIssues.join(' '));
  }

  const expandedDecisions = expandRoutingDecisions(items, decisions);

  let nextStash = { ...stash };
  let nextCredits = cabalCredits;
  const delivered: ResourceQuantity = {};
  const deliveredToRival: CargoRoutingResult['deliveredToRival'] = {};
  const fenced: ResourceQuantity = {};
  const contributed: ResourceQuantity = {};
  const kept: ResourceQuantity = {};
  const opened: ResourceQuantity = {};
  const casketOpenRewards: ResourceQuantity = {};
  const outcomeLines: CargoRoutingOutcomeLine[] = [];
  const rivalDeliveryRewards: CargoRoutingResult['rivalDeliveryRewards'] = [];
  const casketAppraisalResults: CargoRoutingResult['casketAppraisalResults'] = [];
  const casketOpenResults: CargoRoutingResult['casketOpenResults'] = [];
  const generatedSpecialResources: ResourceQuantity = {};
  let creditsFromFence = 0;
  let creditsFromRivalDelivery = 0;
  let creditsFromCasketOpen = 0;
  let appraisalFeesPaid = 0;
  let openingFeesPaid = 0;
  let operationProgressFromCargo = 0;

  (Object.entries(autoStashed) as Array<[ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      if (!quantity || quantity <= 0) return;
      nextStash = addToResourceStash(nextStash, resourceId, quantity);
    },
  );

  expandedDecisions.forEach((decision) => {
    const displayName = getResourceDisplayName(decision.resourceId, true);
    const routableItem = items.find((entry) => entry.resourceId === decision.resourceId);
    switch (decision.action) {
      case 'KEEP_STASH':
        nextStash = addToResourceStash(nextStash, decision.resourceId, decision.quantity);
        kept[decision.resourceId] = (kept[decision.resourceId] ?? 0) + decision.quantity;
        outcomeLines.push({
          resourceId: decision.resourceId,
          quantity: decision.quantity,
          action: decision.action,
          label: `${decision.quantity}× ${displayName} — ${actionLabel(decision.action)}`,
        });
        break;
      case 'DELIVER_SPONSOR':
        delivered[decision.resourceId] = (delivered[decision.resourceId] ?? 0) + decision.quantity;
        outcomeLines.push({
          resourceId: decision.resourceId,
          quantity: decision.quantity,
          action: decision.action,
          label: `${decision.quantity}× ${displayName} — ${actionLabel(decision.action)}`,
        });
        break;
      case 'DELIVER_RIVAL_SPONSOR': {
        const item = items.find((entry) => entry.resourceId === decision.resourceId);
        const offer = item?.bribeOffer;
        if (!offer) {
          throw new Error(`Rival delivery failed for ${decision.resourceId} — no bribe offer.`);
        }
        const sponsorId = offer.rivalSponsorId;
        const rivalBucket = deliveredToRival[sponsorId] ?? {};
        rivalBucket[decision.resourceId] = (rivalBucket[decision.resourceId] ?? 0) + decision.quantity;
        deliveredToRival[sponsorId] = rivalBucket;
        nextCredits += offer.credits;
        creditsFromRivalDelivery += offer.credits;
        offer.resourceBonusIds.forEach((resourceId) => {
          nextStash = addToResourceStash(nextStash, resourceId, 1);
        });
        rivalDeliveryRewards.push({
          sponsorId,
          credits: offer.credits,
          reputation: offer.reputationGain,
          resourceBonusIds: offer.resourceBonusIds,
        });
        outcomeLines.push({
          resourceId: decision.resourceId,
          quantity: decision.quantity,
          action: decision.action,
          label: `${decision.quantity}× ${displayName} — Delivered to ${sponsorDisplayName(sponsorId)} (+${offer.credits} CR)`,
          creditsGained: offer.credits,
        });
        break;
      }
      case 'SELL_FENCE': {
        if (!isFenceableResourceId(decision.resourceId)) {
          throw new Error(`Fence sale failed for ${decision.resourceId}.`);
        }
        const valueMultiplier = resolveKeepsakeFenceValueMultiplier(
          keepsakeRuntime,
          decision.resourceId,
        );
        const unitSellValue = routableItem?.sealedSellValue ?? resolveFenceUnitValue(decision.resourceId);
        const totalSaleValue = Math.round(unitSellValue * decision.quantity * valueMultiplier);
        nextCredits += totalSaleValue;
        creditsFromFence += totalSaleValue;
        fenced[decision.resourceId] = (fenced[decision.resourceId] ?? 0) + decision.quantity;
        const sellLabel = isAppraisableSealedResource(decision.resourceId)
          ? `${decision.quantity}× ${displayName} — Sold sealed to Black Market (+${totalSaleValue} CR)`
          : `${decision.quantity}× ${displayName} — ${actionLabel(decision.action)} (+${totalSaleValue} CR)`;
        outcomeLines.push({
          resourceId: decision.resourceId,
          quantity: decision.quantity,
          action: decision.action,
          label: sellLabel,
          creditsGained: totalSaleValue,
        });
        break;
      }
      case 'CONTRIBUTE_OPERATION': {
        const progress = operationContributionPerStack * decision.quantity;
        operationProgressFromCargo += progress;
        contributed[decision.resourceId] = (contributed[decision.resourceId] ?? 0) + decision.quantity;
        outcomeLines.push({
          resourceId: decision.resourceId,
          quantity: decision.quantity,
          action: decision.action,
          label: `${decision.quantity}× ${displayName} — ${actionLabel(decision.action)} (+${progress} progress)`,
          operationProgressGained: progress,
        });
        break;
      }
      case 'OPEN_SEALED':
      case 'OPEN_AT_HUB': {
        if (!routableItem?.openAtHubEnabled) {
          throw new Error(`Opening failed for ${decision.resourceId}.`);
        }
        opened[decision.resourceId] = (opened[decision.resourceId] ?? 0) + decision.quantity;
        const rewardLabels: string[] = [];
        let openCreditsThisDecision = 0;
        for (let index = 0; index < decision.quantity; index += 1) {
          const openingFee = routableItem.openingFee
            ?? resolveOpeningFee(routableItem.sealedState === 'APPRAISED', decision.resourceId);
          if (nextCredits < openingFee) {
            throw new Error(`Opening requires ${openingFee} credits.`);
          }
          nextCredits -= openingFee;
          openingFeesPaid += openingFee;

          const reward = rollSealedContainerOpenReward(decision.resourceId, {
            valueBand: routableItem.valueBand,
          });
          nextCredits += reward.credits;
          creditsFromCasketOpen += reward.credits;
          openCreditsThisDecision += reward.credits;
          rewardLabels.push(reward.summaryLabel);
          casketOpenResults.push({
            resourceId: decision.resourceId,
            quantity: 1,
            tierId: reward.tierId,
            tierLabel: reward.summaryLabel,
            summaryLabel: reward.summaryLabel,
            dudFlavor: reward.dudFlavor,
            resources: reward.resources,
            credits: reward.credits,
            openingFeePaid: openingFee,
            valueBand: routableItem.valueBand,
          });

          (Object.entries(reward.resources) as Array<[ResourceItemId, number | undefined]>).forEach(
            ([resourceId, quantity]) => {
              if (!quantity || quantity <= 0) return;
              const ctx = routingContext ?? buildCargoRoutingContext(null, null, undefined);
              if (requiresPostRunRouting(resourceId, quantity, ctx)) {
                generatedSpecialResources[resourceId] = (generatedSpecialResources[resourceId] ?? 0) + quantity;
              } else {
                nextStash = addToResourceStash(nextStash, resourceId, quantity);
                casketOpenRewards[resourceId] = (casketOpenRewards[resourceId] ?? 0) + quantity;
              }
            },
          );
        }
        const rewardSummary = rewardLabels.join(' / ');
        const dudLine = casketOpenResults[casketOpenResults.length - 1]?.dudFlavor;
        outcomeLines.push({
          resourceId: decision.resourceId,
          quantity: decision.quantity,
          action: 'OPEN_SEALED',
          label: `${decision.quantity}× ${displayName} — Opened (${rewardSummary}; +${openCreditsThisDecision} CR${dudLine ? ` — ${dudLine}` : ''})`,
          creditsGained: openCreditsThisDecision,
          casketRewardLabel: rewardSummary,
        });
        break;
      }
      default:
        break;
    }
  });

  return {
    result: {
      autoStashed,
      delivered,
      deliveredToRival,
      fenced,
      contributed,
      kept,
      opened,
      creditsFromFence,
      creditsFromRivalDelivery,
      creditsFromCasketOpen,
      casketOpenRewards,
      operationProgressFromCargo,
      outcomeLines,
      deliveredResourcesForContract: delivered,
      rivalDeliveryRewards,
      betrayalEvents: [],
      casketAppraisalResults,
      casketOpenResults,
      appraisalFeesPaid,
      openingFeesPaid,
      generatedSpecialResources,
    },
    stash: nextStash,
    cabalCredits: nextCredits,
  };
}

export function buildPostRunRoutingDebriefState({
  ledger,
  contract,
  operationObjectiveKind,
  operationTargetResourceNames,
  operationId,
  contractProgress,
  extractionKind,
}: {
  ledger: RunResourceLedger;
  contract: ActiveRunContract | null;
  operationObjectiveKind: OperationObjectiveKind | null;
  operationTargetResourceNames: string[] | undefined;
  operationId: string | null;
  contractProgress: ContractRunProgress;
  extractionKind: ContractExtractionKind;
}): PostRunRoutingDebriefState {
  const routingContext = buildCargoRoutingContext(
    contract,
    operationObjectiveKind,
    operationTargetResourceNames,
  );
  const bribeOfferSeed = contract?.contractId
    ? `${contract.contractId}:${contract.sponsorId ?? 'none'}`
    : 'independent';
  const split = splitPostRunCargo(ledger, routingContext, bribeOfferSeed);
  const rules = operationObjectiveKind
    ? resolveContributionRules(operationObjectiveKind)
    : null;
  const operationContributionPerStack = rules?.extractTargetResource
    ?? OPERATION_CONTRIBUTION_VALUES.extractTargetResourceStack;

  const initialContractPendingDelivery = Boolean(
    contract?.objectiveKind
    && isResourceContractObjective(contract.objectiveKind)
    && split.pendingItems.some((item) => item.isContractTarget),
  );

  return {
    pendingItems: split.pendingItems,
    autoStashed: split.autoStash,
    requiresRouting: split.pendingItems.length > 0,
    routingContext,
    initialContractPendingDelivery,
    activeContract: contract,
    contractProgress,
    extractionKind,
    operationId,
    operationContributionPerStack,
    bribeOfferSeed,
    sealedAppraisalByItemKey: {},
  };
}

export function resolveFinalContractResultAfterRouting(
  routingState: PostRunRoutingDebriefState,
  routingResult: CargoRoutingResult | null,
  decisions: CargoRoutingDecision[],
  items: RoutableCargoItem[],
  extractedSuccessfully: boolean,
  ledger?: RunResourceLedger,
  keepsakeRuntime?: KeepsakeRuntime | null,
): ContractResult {
  if (
    routingState.initialContractPendingDelivery
    || (routingResult && items.some((item) => item.isContractTarget))
  ) {
    return resolveContractAfterBetrayalRouting({
      routingState,
      routingResult,
      decisions,
      items,
      extractedSuccessfully,
      ledger,
      keepsakeRuntime,
    });
  }

  const adjustedDelivered = applyKeepsakeDeliveredQuantityBonus(
    routingResult?.deliveredResourcesForContract ?? {},
    keepsakeRuntime,
  );
  if (
    routingState.activeContract?.objectiveKind
    && isResourceContractObjective(routingState.activeContract.objectiveKind)
    && ledger
  ) {
    return resolveContractResult({
      contract: routingState.activeContract,
      ledger,
      progress: routingState.contractProgress,
      extractedSuccessfully,
      extractionKind: routingState.extractionKind,
    });
  }
  return resolveContractAfterRouting({
    contract: routingState.activeContract,
    progress: routingState.contractProgress,
    deliveredResources: adjustedDelivered,
    extractedSuccessfully,
    extractionKind: routingState.extractionKind,
    skipResourceDelivery: true,
  });
}

export interface PostRunCargoRoutingPreview {
  valid: boolean;
  issues: string[];
  operationProgressFromCargo: number;
  creditsFromFence: number;
  creditsFromRivalDelivery: number;
  creditsFromCasketOpen: number;
  contractStatus: ContractResult['status'] | null;
  contractProgressText: string | null;
  contractOutcomeKind: ContractResult['outcomeKind'] | null;
  betrayalSummary: string | null;
}

export function previewPostRunCargoRouting({
  decisions,
  items,
  routingState,
  ledger,
  keepsakeRuntime,
  cabalCredits = 0,
}: {
  decisions: CargoRoutingDecision[];
  items: RoutableCargoItem[];
  routingState: PostRunRoutingDebriefState;
  ledger?: RunResourceLedger;
  keepsakeRuntime?: KeepsakeRuntime | null;
  cabalCredits?: number;
}): PostRunCargoRoutingPreview {
  const issues = validateCargoRoutingDecisions(items, decisions);
  if (issues.length > 0) {
    return {
      valid: false,
      issues,
      operationProgressFromCargo: 0,
      creditsFromFence: 0,
      creditsFromRivalDelivery: 0,
      creditsFromCasketOpen: 0,
      contractStatus: null,
      contractProgressText: null,
      contractOutcomeKind: null,
      betrayalSummary: null,
    };
  }

  try {
    const applied = applyCargoRoutingDecisions({
      decisions,
      items,
      autoStashed: {},
      stash: {},
      cabalCredits,
      operationContributionPerStack: routingState.operationContributionPerStack,
      keepsakeRuntime,
      routingContext: routingState.routingContext,
    });
    const contract = resolveFinalContractResultAfterRouting(
      routingState,
      applied.result,
      decisions,
      items,
      true,
      ledger,
      keepsakeRuntime,
    );
    return {
      valid: true,
      issues: [],
      operationProgressFromCargo: applied.result.operationProgressFromCargo,
      creditsFromFence: applied.result.creditsFromFence,
      creditsFromRivalDelivery: applied.result.creditsFromRivalDelivery,
      creditsFromCasketOpen: applied.result.creditsFromCasketOpen,
      contractStatus: contract.status,
      contractProgressText: contract.progressText,
      contractOutcomeKind: contract.outcomeKind ?? null,
      betrayalSummary: contract.betrayalSummary ?? null,
    };
  } catch (error) {
    return {
      valid: false,
      issues: [error instanceof Error ? error.message : 'Routing preview failed.'],
      operationProgressFromCargo: 0,
      creditsFromFence: 0,
      creditsFromRivalDelivery: 0,
      creditsFromCasketOpen: 0,
      contractStatus: null,
      contractProgressText: null,
      contractOutcomeKind: null,
      betrayalSummary: null,
    };
  }
}

export function formatCargoRoutingActionLabel(action: CargoRoutingAction): string {
  switch (action) {
    case 'KEEP_STASH':
      return 'Keep in Stash';
    case 'DELIVER_SPONSOR':
      return 'Deliver to Sponsor';
    case 'DELIVER_RIVAL_SPONSOR':
      return 'Accept Rival Offer';
    case 'SELL_FENCE':
      return 'Sell to Black Market';
    case 'CONTRIBUTE_OPERATION':
      return 'Contribute to Operation';
    case 'OPEN_SEALED':
    case 'OPEN_AT_HUB':
      return 'Open / Crack Casket';
    default:
      return action;
  }
}

export function formatAutoStashedSummary(autoStashed: ResourceQuantity): string {
  const lines = (Object.entries(autoStashed) as Array<[ResourceItemId, number | undefined]>)
    .filter(([, qty]) => (qty ?? 0) > 0)
    .map(([resourceId, quantity]) => `${getResourceDisplayName(resourceId, true)} x${quantity ?? 0}`);
  return lines.length > 0 ? lines.join(', ') : 'None';
}

export function collectPendingRoutingResourceIds(
  items: RoutableCargoItem[],
): Set<ResourceItemId> {
  return new Set(items.map((item) => item.resourceId));
}

export function buildSecondaryRoutingPendingItems(
  generated: ResourceQuantity,
  ctx: CargoRoutingContext,
  bribeOfferSeed: string,
): RoutableCargoItem[] {
  const ledger = createEmptyRunResourceLedger();
  (Object.entries(generated) as Array<[ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      if (!quantity || quantity <= 0) return;
      ledger.extracted[resourceId] = quantity;
    },
  );
  return splitPostRunCargo(ledger, ctx, bribeOfferSeed).pendingItems;
}

function mergeResourceQuantitiesInto(
  target: ResourceQuantity,
  source: ResourceQuantity,
): ResourceQuantity {
  const next = { ...target };
  (Object.entries(source) as Array<[ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      if (!quantity || quantity <= 0) return;
      next[resourceId] = (next[resourceId] ?? 0) + quantity;
    },
  );
  return next;
}

export function mergeCargoRoutingResults(
  primary: CargoRoutingResult,
  secondary: CargoRoutingResult,
): CargoRoutingResult {
  const deliveredToRival = { ...primary.deliveredToRival };
  Object.entries(secondary.deliveredToRival).forEach(([sponsorId, bucket]) => {
    const key = sponsorId as import('../types/worldState').CabalEmployerId;
    deliveredToRival[key] = mergeResourceQuantitiesInto(deliveredToRival[key] ?? {}, bucket ?? {});
  });

  return {
    autoStashed: mergeResourceQuantitiesInto(primary.autoStashed, secondary.autoStashed),
    delivered: mergeResourceQuantitiesInto(primary.delivered, secondary.delivered),
    deliveredToRival,
    fenced: mergeResourceQuantitiesInto(primary.fenced, secondary.fenced),
    contributed: mergeResourceQuantitiesInto(primary.contributed, secondary.contributed),
    kept: mergeResourceQuantitiesInto(primary.kept, secondary.kept),
    opened: mergeResourceQuantitiesInto(primary.opened, secondary.opened),
    creditsFromFence: primary.creditsFromFence + secondary.creditsFromFence,
    creditsFromRivalDelivery: primary.creditsFromRivalDelivery + secondary.creditsFromRivalDelivery,
    creditsFromCasketOpen: primary.creditsFromCasketOpen + secondary.creditsFromCasketOpen,
    casketOpenRewards: mergeResourceQuantitiesInto(primary.casketOpenRewards, secondary.casketOpenRewards),
    operationProgressFromCargo: primary.operationProgressFromCargo + secondary.operationProgressFromCargo,
    outcomeLines: [...primary.outcomeLines, ...secondary.outcomeLines],
    deliveredResourcesForContract: mergeResourceQuantitiesInto(
      primary.deliveredResourcesForContract,
      secondary.deliveredResourcesForContract,
    ),
    rivalDeliveryRewards: [...primary.rivalDeliveryRewards, ...secondary.rivalDeliveryRewards],
    betrayalEvents: [...primary.betrayalEvents, ...secondary.betrayalEvents],
    casketAppraisalResults: [...primary.casketAppraisalResults, ...secondary.casketAppraisalResults],
    casketOpenResults: [...primary.casketOpenResults, ...secondary.casketOpenResults],
    appraisalFeesPaid: primary.appraisalFeesPaid + secondary.appraisalFeesPaid,
    openingFeesPaid: primary.openingFeesPaid + secondary.openingFeesPaid,
    generatedSpecialResources: secondary.generatedSpecialResources,
  };
}
