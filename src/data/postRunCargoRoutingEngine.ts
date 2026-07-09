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
import type { OperationObjectiveKind } from '../types/worldState';
import {
  isResourceContractObjective,
  resolveContractAfterRouting,
  resolveContractPendingDelivery,
  resolveContractResult,
} from './contractResolver';
import { creditFenceSale } from './hubSafehouseEngine';
import { resolveContributionRules } from './operationRulesEngine';
import {
  ALL_RESOURCE_ITEM_IDS,
  canResourceBeSoldToFence,
  getResourceCategory,
  getResourceDisplayName,
  getResourceSellValue,
  isFenceableResourceId,
  RESOURCE_REGISTRY,
} from './resourceRegistry';
import { addToResourceStash } from './resourceStashEngine';
import { rollSealedCasketOpenReward } from './sealedCasketOpenEngine';
import { mergeResourceQuantities } from './runResourceLedgerEngine';
import { OPERATION_CONTRIBUTION_VALUES } from './worldStateHelpers';

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
): Pick<
  RoutableCargoItem,
  | 'canFence'
  | 'canKeep'
  | 'canDeliver'
  | 'canContribute'
  | 'canOpenAtHub'
  | 'openAtHubEnabled'
  | 'validActions'
> {
  const def = RESOURCE_REGISTRY[resourceId];
  const canFence = canResourceBeSoldToFence(resourceId);
  const canDeliver = isContractTargetResource(resourceId, ctx.contract)
    && Boolean(ctx.contract?.sponsorId);
  const canContribute = isOperationTargetResource(resourceId, ctx);
  const canOpenAtHub = def.canOpenAtHub;
  const openAtHubEnabled = resourceId === 'sealed-containment-casket' && def.canOpenAtHub;

  const validActions: CargoRoutingAction[] = ['KEEP_STASH'];
  if (canDeliver) validActions.push('DELIVER_SPONSOR');
  if (canFence) validActions.push('SELL_FENCE');
  if (canContribute) validActions.push('CONTRIBUTE_OPERATION');
  if (canOpenAtHub) validActions.push('OPEN_AT_HUB');

  return {
    canFence,
    canKeep: true,
    canDeliver,
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
  if (validActions.includes('DELIVER_SPONSOR') && isContractTargetResource(resourceId, ctx.contract)) {
    return 'DELIVER_SPONSOR';
  }
  if (validActions.includes('CONTRIBUTE_OPERATION') && isOperationTargetResource(resourceId, ctx)) {
    return 'CONTRIBUTE_OPERATION';
  }
  if (
    resourceId === 'sealed-containment-casket'
    && validActions.includes('OPEN_AT_HUB')
    && !isContractTargetResource(resourceId, ctx.contract)
  ) {
    return 'OPEN_AT_HUB';
  }
  if (validActions.includes('SELL_FENCE')) {
    const sellValue = getResourceSellValue(resourceId);
    if (sellValue >= 100 || resourceId === 'smugglers-ledger' || resourceId === 'tarnished-dog-tags') {
      return 'SELL_FENCE';
    }
  }
  if (RESOURCE_REGISTRY[resourceId].canBeCraftingIngredient && validActions.includes('KEEP_STASH')) {
    return 'KEEP_STASH';
  }
  if (resourceId === 'sealed-containment-casket' && validActions.includes('KEEP_STASH')) {
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
  if (def.maxStack <= 1) return false;
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
): RoutableCargoItem {
  const actions = buildValidActions(resourceId, ctx);
  const recommendedAction = recommendCargoRoutingAction(resourceId, ctx, actions.validActions);
  const isContractTarget = isContractTargetResource(resourceId, ctx.contract);
  const isOperationTarget = isOperationTargetResource(resourceId, ctx);

  let contractWarning: string | null = null;
  if (isContractTarget && recommendedAction !== 'DELIVER_SPONSOR') {
    contractWarning = 'Contract will not complete if this item is not delivered.';
  }

  return {
    resourceId,
    quantity,
    source,
    isContractTarget,
    isOperationTarget,
    recommendedAction,
    contractWarning,
    ...actions,
  };
}

export function splitPostRunCargo(
  ledger: RunResourceLedger,
  ctx: CargoRoutingContext,
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
    if (decision.action === 'OPEN_AT_HUB' && !item.openAtHubEnabled) {
      issues.push(`${item.resourceId} hub opening is not available in v1.`);
    }
    if (decision.quantity <= 0 || decision.quantity > item.quantity) {
      issues.push(`${item.resourceId} routing quantity must be between 1 and ${item.quantity}.`);
    }
    if (decision.quantity < item.quantity && decision.action === 'KEEP_STASH') {
      issues.push(`${item.resourceId} partial keep is invalid — route a subset to another action.`);
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
    case 'SELL_FENCE':
      return 'Sold to Black Market';
    case 'CONTRIBUTE_OPERATION':
      return 'Contributed to operation';
    case 'OPEN_AT_HUB':
      return 'Opened at hub';
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
}: {
  decisions: CargoRoutingDecision[];
  items: RoutableCargoItem[];
  autoStashed: ResourceQuantity;
  stash: ResourceQuantity;
  cabalCredits: number;
  operationContributionPerStack: number;
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
  const fenced: ResourceQuantity = {};
  const contributed: ResourceQuantity = {};
  const kept: ResourceQuantity = {};
  const opened: ResourceQuantity = {};
  const casketOpenRewards: ResourceQuantity = {};
  const outcomeLines: CargoRoutingOutcomeLine[] = [];
  let creditsFromFence = 0;
  let creditsFromCasketOpen = 0;
  let operationProgressFromCargo = 0;

  (Object.entries(autoStashed) as Array<[ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      if (!quantity || quantity <= 0) return;
      nextStash = addToResourceStash(nextStash, resourceId, quantity);
    },
  );

  expandedDecisions.forEach((decision) => {
    const displayName = getResourceDisplayName(decision.resourceId, true);
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
      case 'SELL_FENCE': {
        if (!isFenceableResourceId(decision.resourceId)) {
          throw new Error(`Fence sale failed for ${decision.resourceId}.`);
        }
        const sale = creditFenceSale(nextCredits, decision.resourceId, decision.quantity);
        if (!sale) {
          throw new Error(`Fence sale failed for ${decision.resourceId}.`);
        }
        nextCredits = sale.cabalCredits;
        creditsFromFence += sale.creditsEarned;
        fenced[decision.resourceId] = (fenced[decision.resourceId] ?? 0) + decision.quantity;
        outcomeLines.push({
          resourceId: decision.resourceId,
          quantity: decision.quantity,
          action: decision.action,
          label: `${decision.quantity}× ${displayName} — ${actionLabel(decision.action)} (+${sale.creditsEarned} CR)`,
          creditsGained: sale.creditsEarned,
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
      case 'OPEN_AT_HUB': {
        opened[decision.resourceId] = (opened[decision.resourceId] ?? 0) + decision.quantity;
        const rewardLabels: string[] = [];
        let openCreditsThisDecision = 0;
        for (let index = 0; index < decision.quantity; index += 1) {
          const reward = rollSealedCasketOpenReward();
          nextCredits += reward.credits;
          creditsFromCasketOpen += reward.credits;
          openCreditsThisDecision += reward.credits;
          rewardLabels.push(reward.summaryLabel);
          (Object.entries(reward.resources) as Array<[ResourceItemId, number | undefined]>).forEach(
            ([resourceId, quantity]) => {
              if (!quantity || quantity <= 0) return;
              nextStash = addToResourceStash(nextStash, resourceId, quantity);
              casketOpenRewards[resourceId] = (casketOpenRewards[resourceId] ?? 0) + quantity;
            },
          );
        }
        const rewardSummary = rewardLabels.join(' / ');
        outcomeLines.push({
          resourceId: decision.resourceId,
          quantity: decision.quantity,
          action: decision.action,
          label: `${decision.quantity}× ${displayName} — ${actionLabel(decision.action)} (${rewardSummary}; +${openCreditsThisDecision} CR)`,
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
      fenced,
      contributed,
      kept,
      opened,
      creditsFromFence,
      creditsFromCasketOpen,
      casketOpenRewards,
      operationProgressFromCargo,
      outcomeLines,
      deliveredResourcesForContract: delivered,
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
  const split = splitPostRunCargo(ledger, routingContext);
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
  };
}

export function resolveFinalContractResultAfterRouting(
  routingState: PostRunRoutingDebriefState,
  deliveredResources: ResourceQuantity,
  extractedSuccessfully: boolean,
  ledger?: RunResourceLedger,
): ContractResult {
  if (!routingState.initialContractPendingDelivery) {
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
      deliveredResources,
      extractedSuccessfully,
      extractionKind: routingState.extractionKind,
      skipResourceDelivery: true,
    });
  }
  return resolveContractAfterRouting({
    contract: routingState.activeContract,
    progress: routingState.contractProgress,
    deliveredResources,
    extractedSuccessfully,
    extractionKind: routingState.extractionKind,
  });
}

export interface PostRunCargoRoutingPreview {
  valid: boolean;
  issues: string[];
  operationProgressFromCargo: number;
  creditsFromFence: number;
  creditsFromCasketOpen: number;
  contractStatus: ContractResult['status'] | null;
  contractProgressText: string | null;
}

export function previewPostRunCargoRouting({
  decisions,
  items,
  routingState,
  ledger,
}: {
  decisions: CargoRoutingDecision[];
  items: RoutableCargoItem[];
  routingState: PostRunRoutingDebriefState;
  ledger?: RunResourceLedger;
}): PostRunCargoRoutingPreview {
  const issues = validateCargoRoutingDecisions(items, decisions);
  if (issues.length > 0) {
    return {
      valid: false,
      issues,
      operationProgressFromCargo: 0,
      creditsFromFence: 0,
      creditsFromCasketOpen: 0,
      contractStatus: null,
      contractProgressText: null,
    };
  }

  try {
    const applied = applyCargoRoutingDecisions({
      decisions,
      items,
      autoStashed: {},
      stash: {},
      cabalCredits: 0,
      operationContributionPerStack: routingState.operationContributionPerStack,
    });
    const contract = resolveFinalContractResultAfterRouting(
      routingState,
      applied.result.deliveredResourcesForContract,
      true,
      ledger,
    );
    return {
      valid: true,
      issues: [],
      operationProgressFromCargo: applied.result.operationProgressFromCargo,
      creditsFromFence: applied.result.creditsFromFence,
      creditsFromCasketOpen: applied.result.creditsFromCasketOpen,
      contractStatus: contract.status,
      contractProgressText: contract.progressText,
    };
  } catch (error) {
    return {
      valid: false,
      issues: [error instanceof Error ? error.message : 'Routing preview failed.'],
      operationProgressFromCargo: 0,
      creditsFromFence: 0,
      creditsFromCasketOpen: 0,
      contractStatus: null,
      contractProgressText: null,
    };
  }
}

export function formatCargoRoutingActionLabel(action: CargoRoutingAction): string {
  switch (action) {
    case 'KEEP_STASH':
      return 'Keep in Stash';
    case 'DELIVER_SPONSOR':
      return 'Deliver to Sponsor';
    case 'SELL_FENCE':
      return 'Sell to Black Market';
    case 'CONTRIBUTE_OPERATION':
      return 'Contribute to Operation';
    case 'OPEN_AT_HUB':
      return 'Open at Hub';
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
