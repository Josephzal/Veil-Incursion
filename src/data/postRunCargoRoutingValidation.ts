import type { ActiveRunContract, GeneratedContract } from '../types/contract';
import type { CargoRoutingAction, CargoRoutingDecision, CargoRoutingResult, RoutableCargoItem } from '../types/postRunCargoRouting';
import { createEmptyContractRunProgress } from '../types/contract';
import type { ResourceItemId } from '../types/resourceItem';
import type { PostRunRoutingDebriefState } from '../types/postRunCargoRouting';
import {
  ALL_RESOURCE_ITEM_IDS,
  canResourceBeSoldToFence,
  CONTRACT_TARGET_RESOURCE_IDS,
  getResourceCategory,
  getResourceSellValue,
  hasResourceUsageTag,
  RESOURCE_REGISTRY,
} from './resourceRegistry';
import { CRAFTING_REGISTRY } from './craftingRegistry';
import {
  buildCargoRoutingContext,
  buildDefaultRoutingDecisions,
  applyCargoRoutingDecisions,
  buildPostRunRoutingDebriefState,
  isContractTargetResource,
  isOperationTargetResource,
  expandRoutingDecisions,
  requiresPostRunRouting,
  splitPostRunCargo,
} from './postRunCargoRoutingEngine';
import type { CargoRoutingContext } from '../types/postRunCargoRouting';
import { createEmptyRunResourceLedger } from '../types/runResourceLedger';
import { SEALED_CASKET_REWARD_RESOURCE_IDS } from './sealedCasketOpenEngine';
import type { CareerCargoRoutingStats } from './postRunCargoRoutingRunState';
import {
  formatActiveContractCargoDeliveryHints,
  formatCargoRoutingBlackMarketIntelLines,
  formatCargoRoutingOperationContributionHints,
  formatCargoRoutingPostExtractReminder,
  formatContractCargoDeliveryHints,
} from './cargoRoutingIntelEngine';
import { CONTRACT_TEMPLATE_SPECS } from './contractTemplates';
import {
  mergeTestResourcesIntoLedger,
  POST_RUN_ROUTING_TEST_LEDGER,
} from './postRunCargoRoutingFixtures';
import { OPERATION_CONTRIBUTION_VALUES } from './worldStateHelpers';

export interface PostRunCargoRoutingValidationIssue {
  severity: 'error' | 'warn';
  message: string;
  resourceId?: ResourceItemId;
}

export function validatePostRunCargoRoutingCatalog(): PostRunCargoRoutingValidationIssue[] {
  const issues: PostRunCargoRoutingValidationIssue[] = [];

  CONTRACT_TARGET_RESOURCE_IDS.forEach((resourceId) => {
    const def = RESOURCE_REGISTRY[resourceId];
    if (!def.canBeContractTarget) {
      issues.push({
        severity: 'error',
        resourceId,
        message: 'Contract target resource is not marked canBeContractTarget.',
      });
    }
  });

  Object.entries(RESOURCE_REGISTRY).forEach(([resourceId, def]) => {
    const id = resourceId as ResourceItemId;
    if (def.canBeSoldToFence && def.sellValue <= 0) {
      issues.push({
        severity: 'error',
        resourceId: id,
        message: 'Sellable item has no sell value.',
      });
    }
    if (hasResourceUsageTag(id, 'FENCE_VALUE') && !def.canBeSoldToFence) {
      issues.push({
        severity: 'warn',
        resourceId: id,
        message: 'FENCE_VALUE item cannot be sold to fence.',
      });
    }
    if (!def.canBeCraftingIngredient) {
      const usedInRecipe = CRAFTING_REGISTRY.some((recipe) => (
        recipe.requirements.some((req) => req.resourceId === id)
      ));
      if (usedInRecipe) {
        issues.push({
          severity: 'error',
          resourceId: id,
          message: 'Item marked canBeCraftingIngredient false appears in recipe.',
        });
      }
    }
  });

  return issues;
}

export function validateRoutableItemActions(
  item: RoutableCargoItem,
  contract: ActiveRunContract | null,
  ctx: CargoRoutingContext,
): PostRunCargoRoutingValidationIssue[] {
  const issues: PostRunCargoRoutingValidationIssue[] = [];
  const def = RESOURCE_REGISTRY[item.resourceId];

  if (item.canFence && !canResourceBeSoldToFence(item.resourceId)) {
    issues.push({
      severity: 'error',
      resourceId: item.resourceId,
      message: 'Routable item marked fenceable but registry disallows fence sale.',
    });
  }

  if (item.canDeliver && !isContractTargetResource(item.resourceId, contract)) {
    issues.push({
      severity: 'error',
      resourceId: item.resourceId,
      message: 'Contract target item cannot be routed to sponsor.',
    });
  }

  if (item.canContribute && !isOperationTargetResource(item.resourceId, ctx)) {
    issues.push({
      severity: 'error',
      resourceId: item.resourceId,
      message: 'Operation target item cannot contribute to operation.',
    });
  }

  if (item.canOpenAtHub && item.openAtHubEnabled && !def.canOpenAtHub) {
    issues.push({
      severity: 'warn',
      resourceId: item.resourceId,
      message: 'Hub open action enabled without canOpenAtHub metadata.',
    });
  }

  if (!item.canKeep) {
    issues.push({
      severity: 'warn',
      resourceId: item.resourceId,
      message: 'Routable item has no keep-in-stash action.',
    });
  }

  return issues;
}

export function validatePendingRoutableItems(
  routingState: PostRunRoutingDebriefState,
): PostRunCargoRoutingValidationIssue[] {
  const issues: PostRunCargoRoutingValidationIssue[] = [];
  routingState.pendingItems.forEach((item) => {
    issues.push(
      ...validateRoutableItemActions(
        item,
        routingState.activeContract,
        routingState.routingContext,
      ),
    );
  });
  return issues;
}

export function validateCargoRoutingIntelReferences(): PostRunCargoRoutingValidationIssue[] {
  const issues: PostRunCargoRoutingValidationIssue[] = [];

  if (!formatCargoRoutingPostExtractReminder()) {
    issues.push({
      severity: 'error',
      message: 'Post-extract cargo routing reminder is empty.',
    });
  }

  const operationHints = formatCargoRoutingOperationContributionHints(
    { extractTargetResource: OPERATION_CONTRIBUTION_VALUES.extractTargetResourceStack },
    ['Ley Slag'],
  );
  if (operationHints.length === 0) {
    issues.push({
      severity: 'error',
      message: 'Cargo routing operation contribution hints missing for extractTargetResource.',
    });
  }

  const blackMarketLines = formatCargoRoutingBlackMarketIntelLines();
  if (blackMarketLines.length < 2) {
    issues.push({
      severity: 'warn',
      message: 'Black Market cargo routing intel lines are unexpectedly short.',
    });
  }

  const resourceContracts = CONTRACT_TEMPLATE_SPECS.filter((spec) => (
    spec.kind === 'RECOVER_ECONOMY_INTEL'
    || spec.kind === 'RECOVER_CONTRABAND'
    || spec.kind === 'RECOVER_INTEL'
  ));
  resourceContracts.forEach((spec) => {
    const mockContract: ActiveRunContract = {
      contractId: `fixture-${spec.kind}`,
      sponsorId: 'TERRAN_GRID',
      title: `Fixture ${spec.kind}`,
      objectiveKind: spec.kind,
      objectiveText: 'Fixture validation contract.',
      targetResourceId: 'smugglers-ledger',
      targetQuantity: 1,
      validSectorIds: ['THE_ASHEN_WASTES'],
      recommendedSectorIds: ['THE_ASHEN_WASTES'],
      reward: null,
      difficulty: 2,
      selectedAtRunIndex: 0,
    };
    const generatedHints = formatContractCargoDeliveryHints({
      id: mockContract.contractId ?? `fixture-${spec.kind}`,
      sponsorId: mockContract.sponsorId ?? 'TERRAN_GRID',
      title: mockContract.title,
      objectiveKind: spec.kind,
      objectiveText: mockContract.objectiveText,
      targetResourceId: mockContract.targetResourceId,
      targetQuantity: mockContract.targetQuantity ?? 1,
      validSectorIds: mockContract.validSectorIds,
      recommendedSectorIds: mockContract.recommendedSectorIds,
      reward: mockContract.reward ?? { credits: 100, reputation: 10, resourceBonusIds: [] },
      difficulty: mockContract.difficulty,
      refreshLabel: 'fixture',
    } satisfies GeneratedContract);
    const activeHints = formatActiveContractCargoDeliveryHints(mockContract);
    if (generatedHints.length === 0 || activeHints.length === 0) {
      issues.push({
        severity: 'error',
        message: `Contract cargo delivery hints missing for ${spec.kind}.`,
      });
    }
  });

  return issues;
}

export const ROUTING_FIXTURE_CONTRACT: ActiveRunContract = {
  contractId: 'fixture-intel-contract',
  sponsorId: 'TERRAN_GRID',
  title: 'Fixture Intel Contract',
  objectiveKind: 'RECOVER_INTEL',
  objectiveText: 'Recover intel for fixture validation.',
  targetResourceId: 'smugglers-ledger',
  targetQuantity: 1,
  validSectorIds: ['THE_ASHEN_WASTES'],
  recommendedSectorIds: ['THE_ASHEN_WASTES'],
  reward: null,
  difficulty: 2,
  selectedAtRunIndex: 0,
};

const ROUTING_FIXTURE_CONTEXT: CargoRoutingContext = buildCargoRoutingContext(
  ROUTING_FIXTURE_CONTRACT,
  'RESOURCE_SURVEY',
  ['Ley Slag'],
);

export function validateAllSpecialCargoRoutingFixtures(): PostRunCargoRoutingValidationIssue[] {
  const issues: PostRunCargoRoutingValidationIssue[] = [];

  ALL_RESOURCE_ITEM_IDS.forEach((resourceId) => {
    const def = RESOURCE_REGISTRY[resourceId];
    const isSpecial = getResourceCategory(resourceId) !== 'STABLE'
      || def.canBeContractTarget
      || def.canBeOperationTarget;
    if (!isSpecial) return;

    const ledger = {
      ...createEmptyRunResourceLedger(),
      extracted: { [resourceId]: 1 },
    };
    const split = splitPostRunCargo(ledger, ROUTING_FIXTURE_CONTEXT);

    if (requiresPostRunRouting(resourceId, 1, ROUTING_FIXTURE_CONTEXT) && split.pendingItems.length === 0) {
      issues.push({
        severity: 'error',
        resourceId,
        message: 'Special resource did not enter pending routing split in fixture.',
      });
      return;
    }

    split.pendingItems.forEach((item) => {
      issues.push(
        ...validateRoutableItemActions(item, ROUTING_FIXTURE_CONTRACT, ROUTING_FIXTURE_CONTEXT),
      );
    });
  });

  return issues;
}

export function validateSealedCasketRewardTable(): PostRunCargoRoutingValidationIssue[] {
  const issues: PostRunCargoRoutingValidationIssue[] = [];
  SEALED_CASKET_REWARD_RESOURCE_IDS.forEach((resourceId) => {
    if (!RESOURCE_REGISTRY[resourceId]) {
      issues.push({
        severity: 'error',
        resourceId,
        message: 'Sealed casket reward references unknown resource.',
      });
    }
  });
  return issues;
}

export function validateDefaultRoutingApplyIntegrity(): PostRunCargoRoutingValidationIssue[] {
  const issues: PostRunCargoRoutingValidationIssue[] = [];

  ALL_RESOURCE_ITEM_IDS.forEach((resourceId) => {
    const def = RESOURCE_REGISTRY[resourceId];
    const isSpecial = getResourceCategory(resourceId) !== 'STABLE'
      || def.canBeContractTarget
      || def.canBeOperationTarget;
    if (!isSpecial) return;

    const ledger = {
      ...createEmptyRunResourceLedger(),
      extracted: { [resourceId]: 1 },
    };
    const split = splitPostRunCargo(ledger, ROUTING_FIXTURE_CONTEXT);
    if (split.pendingItems.length === 0) return;

    const decisions = buildDefaultRoutingDecisions(split.pendingItems);
    const applied = applyCargoRoutingDecisions({
      decisions,
      items: split.pendingItems,
      autoStashed: split.autoStash,
      stash: {},
      cabalCredits: 0,
      operationContributionPerStack: OPERATION_CONTRIBUTION_VALUES.extractTargetResourceStack,
    });

    issues.push(
      ...validateCargoRoutingResultIntegrity(
        split.pendingItems,
        decisions,
        applied.result,
      ),
    );
  });

  return issues;
}

export function validateCareerCargoRoutingStats(
  stats: CareerCargoRoutingStats | undefined,
): PostRunCargoRoutingValidationIssue[] {
  if (!stats) return [];
  const issues: PostRunCargoRoutingValidationIssue[] = [];
  (Object.entries(stats) as Array<[keyof CareerCargoRoutingStats, number]>).forEach(
    ([key, value]) => {
      if (value < 0) {
        issues.push({
          severity: 'error',
          message: `Career cargo routing stat ${key} is negative (${value}).`,
        });
      }
    },
  );
  return issues;
}

export function validateAllRoutingSimIntegrity(): PostRunCargoRoutingValidationIssue[] {
  const issues: PostRunCargoRoutingValidationIssue[] = [];
  const ledger = mergeTestResourcesIntoLedger(createEmptyRunResourceLedger(), POST_RUN_ROUTING_TEST_LEDGER);
  const routingState = buildPostRunRoutingDebriefState({
    ledger,
    contract: ROUTING_FIXTURE_CONTRACT,
    operationObjectiveKind: 'RESOURCE_SURVEY',
    operationTargetResourceNames: ['Ley Slag'],
    operationId: 'fixture-operation',
    contractProgress: createEmptyContractRunProgress(),
    extractionKind: 'STANDARD',
  });

  if (!routingState.requiresRouting) {
    issues.push({
      severity: 'error',
      message: 'Routing sim fixture ledger produced no routable cargo.',
    });
    return issues;
  }

  const scenarioOverrides: Array<Partial<Record<ResourceItemId, CargoRoutingAction>>> = [
    {},
    { 'smugglers-ledger': 'SELL_FENCE', 'tarnished-dog-tags': 'SELL_FENCE' },
    { 'smugglers-ledger': 'DELIVER_SPONSOR' },
    { 'ley-slag': 'CONTRIBUTE_OPERATION' },
    { 'sealed-containment-casket': 'OPEN_AT_HUB' },
    { 'tarnished-dog-tags': 'SELL_FENCE' },
  ];

  scenarioOverrides.forEach((overrides, index) => {
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
    const integrityIssues = validateCargoRoutingResultIntegrity(
      routingState.pendingItems,
      decisions,
      applied.result,
    );
    if (integrityIssues.length > 0) {
      issues.push({
        severity: 'error',
        message: `Routing sim scenario ${index + 1} failed integrity (${integrityIssues.length} issue(s)).`,
      });
    }
  });

  return issues;
}

export function validatePostRunCargoRoutingPipeline(
  routingState?: PostRunRoutingDebriefState | null,
): PostRunCargoRoutingValidationIssue[] {
  const issues = [
    ...validatePostRunCargoRoutingCatalog(),
    ...validateCargoRoutingIntelReferences(),
    ...validateAllSpecialCargoRoutingFixtures(),
    ...validateSealedCasketRewardTable(),
    ...validateDefaultRoutingApplyIntegrity(),
    ...validateAllRoutingSimIntegrity(),
  ];
  if (routingState?.requiresRouting) {
    issues.push(...validatePendingRoutableItems(routingState));
  }
  return issues;
}

export function validateCargoRoutingResultIntegrity(
  items: RoutableCargoItem[],
  decisions: CargoRoutingDecision[],
  result: CargoRoutingResult,
): PostRunCargoRoutingValidationIssue[] {
  const issues: PostRunCargoRoutingValidationIssue[] = [];
  const expandedDecisions = expandRoutingDecisions(items, decisions);
  const routedTotals = new Map<ResourceItemId, number>();

  expandedDecisions.forEach((decision) => {
    routedTotals.set(
      decision.resourceId,
      (routedTotals.get(decision.resourceId) ?? 0) + decision.quantity,
    );
  });

  items.forEach((item) => {
    const routed = routedTotals.get(item.resourceId) ?? 0;
    if (routed !== item.quantity) {
      issues.push({
        severity: 'error',
        resourceId: item.resourceId,
        message: 'Routed item quantity does not match owned quantity.',
      });
    }
  });

  const destinationTotals = new Map<ResourceItemId, number>();
  const addQty = (map: Map<ResourceItemId, number>, entries: Partial<Record<ResourceItemId, number>>) => {
    Object.entries(entries).forEach(([resourceId, quantity]) => {
      if (!quantity || quantity <= 0) return;
      const id = resourceId as ResourceItemId;
      map.set(id, (map.get(id) ?? 0) + quantity);
    });
  };

  addQty(destinationTotals, result.delivered);
  Object.values(result.deliveredToRival).forEach((bucket) => {
    addQty(destinationTotals, bucket ?? {});
  });
  addQty(destinationTotals, result.fenced);
  addQty(destinationTotals, result.contributed);
  addQty(destinationTotals, result.kept);
  addQty(destinationTotals, result.opened);

  items.forEach((item) => {
    const total = destinationTotals.get(item.resourceId) ?? 0;
    if (total !== item.quantity) {
      issues.push({
        severity: 'error',
        resourceId: item.resourceId,
        message: 'Routed item appears in multiple destinations or was duplicated.',
      });
    }
  });

  Object.entries(result.fenced).forEach(([resourceId, quantity]) => {
    if (!quantity || quantity <= 0) return;
    const id = resourceId as ResourceItemId;
    const expectedCredits = getResourceSellValue(id) * quantity;
    const fencedCredits = result.outcomeLines
      .filter((line) => line.resourceId === id && line.action === 'SELL_FENCE')
      .reduce((sum, line) => sum + (line.creditsGained ?? 0), 0);
    if (fencedCredits !== expectedCredits) {
      issues.push({
        severity: 'error',
        resourceId: id,
        message: 'Sold item did not grant expected credits.',
      });
    }
  });

  return issues;
}

export function formatPostRunCargoRoutingValidationReport(
  issues: PostRunCargoRoutingValidationIssue[],
): string {
  if (issues.length === 0) return 'POST-RUN CARGO ROUTING — no validation issues.';
  return [
    'POST-RUN CARGO ROUTING VALIDATION',
    ...issues.map((issue) => `[${issue.severity.toUpperCase()}] ${issue.resourceId ? `${issue.resourceId}: ` : ''}${issue.message}`),
  ].join('\n');
}
