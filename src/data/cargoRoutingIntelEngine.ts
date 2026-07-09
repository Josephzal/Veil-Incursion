import type { ActiveRunContract, GeneratedContract, SelectedContractState } from '../types/contract';
import type { ContractObjectiveKind } from '../types/contract';
import type {
  OperationContributionRules,
  RunGenerationContext,
  SectorState,
} from '../types/worldState';
import type { RunResourceLedger } from '../types/runResourceLedger';
import type { ResourceItemId } from '../types/resourceItem';
import { isResourceContractObjective } from './contractResolver';
import {
  buildCargoRoutingContext,
  requiresPostRunRouting,
} from './postRunCargoRoutingEngine';
import { mergeResourceQuantities } from './runResourceLedgerEngine';
import { getResourceDisplayName } from './resourceRegistry';
import { OPERATION_CONTRIBUTION_VALUES } from './worldStateHelpers';

export function formatCargoRoutingPostExtractReminder(): string {
  return 'Unstable, intel, and contraband cargo require post-run routing on successful extraction.';
}

export function formatCargoRoutingOperationContributionHints(
  rules: OperationContributionRules,
  operationTargetResourceNames?: string[],
): string[] {
  if (!rules.extractTargetResource) return [];

  const perStack = rules.extractTargetResource
    ?? OPERATION_CONTRIBUTION_VALUES.extractTargetResourceStack;
  const targetLabel = operationTargetResourceNames?.length
    ? operationTargetResourceNames.slice(0, 2).join(' / ')
    : 'operation target salvage';

  return [`Contribute recovered ${targetLabel} at debrief (+${perStack} progress per stack)`];
}

export function formatContractCargoDeliveryHints(contract: GeneratedContract): string[] {
  return formatContractCargoDeliveryHintLines(contract);
}

function formatContractCargoDeliveryHintLines(contract: {
  objectiveKind: ContractObjectiveKind | null | undefined;
  targetResourceId?: ResourceItemId;
  targetResourceOptions?: ResourceItemId[];
  targetCategory?: string;
  targetQuantity?: number;
}): string[] {
  if (!contract.objectiveKind || !isResourceContractObjective(contract.objectiveKind)) return [];

  const targetName = contract.targetResourceId
    ? getResourceDisplayName(contract.targetResourceId, true)
    : contract.targetResourceOptions?.length
      ? contract.targetResourceOptions.map((id) => getResourceDisplayName(id, true)).join(' / ')
      : contract.targetCategory ?? 'contract cargo';
  const quantity = contract.targetQuantity ?? 1;

  return [
    `Deliver ${quantity}× ${targetName} to sponsor during post-run cargo routing for payout.`,
    'Keeping or selling contract cargo prevents completion (no betrayal penalties in v1).',
  ];
}

export function formatActiveContractCargoDeliveryHints(
  contract: ActiveRunContract | null | undefined,
): string[] {
  if (!contract?.objectiveKind) return [];
  return formatContractCargoDeliveryHintLines(contract);
}

export function formatCargoRoutingDeployBriefingLine(
  sector: SectorState,
  selectedContract: SelectedContractState,
): string | null {
  if (
    selectedContract.kind === 'SPONSOR'
    && isResourceContractObjective(selectedContract.contract.objectiveKind)
  ) {
    return 'Resource contract — confirm sponsor delivery during post-run cargo routing.';
  }
  if (sector.activeOperation.contributionRules.extractTargetResource) {
    return 'Operation accepts target salvage — contribute special cargo at post-run debrief.';
  }
  return formatCargoRoutingPostExtractReminder();
}

export function formatCargoRoutingSectorIntelLines(
  sector: SectorState,
  selectedContract: SelectedContractState,
): string[] {
  const lines: string[] = [];
  const deployLine = formatCargoRoutingDeployBriefingLine(sector, selectedContract);
  if (deployLine) {
    lines.push(deployLine);
  }

  lines.push(
    ...formatCargoRoutingOperationContributionHints(
      sector.activeOperation.contributionRules,
      sector.activeOperation.rewardEmphasis.targetResources,
    ),
  );

  if (selectedContract.kind === 'SPONSOR') {
    lines.push(...formatContractCargoDeliveryHints(selectedContract.contract));
  }

  return [...new Set(lines)];
}

export function formatCargoRoutingBlackMarketIntelLines(): string[] {
  return [
    'Fence eligible stash salvage here for immediate Cabal Credits.',
    'Freshly extracted intel and contraband can be sold during post-run debrief routing.',
    'Stable materials auto-stash; special cargo always prompts a routing decision on extract.',
  ];
}

export function formatCargoRoutingSafehouseIntelLines(): string[] {
  return [
    'Bank physical cargo at the in-run safehouse — banked stacks survive death and auto-deposit to hub stash.',
    'Special cargo (intel, contraband, contract targets) still requires post-run routing on successful extraction.',
    'Unbanked special cargo is lost on death; plan banking before risky pushes.',
  ];
}

export function formatCargoRoutingScannerTelemetry(
  runContext: RunGenerationContext | null | undefined,
  ledger?: RunResourceLedger,
  contract?: ActiveRunContract | null,
): string[] {
  if (!runContext || !ledger) return [];

  const ctx = buildCargoRoutingContext(
    contract ?? null,
    runContext.activeOperation.objectiveKind,
    runContext.activeOperation.rewardEmphasis.targetResources,
  );

  const held = mergeResourceQuantities(ledger.collected, ledger.bankedAtSafehouse);
  let specialStacks = 0;
  (Object.entries(held) as Array<[ResourceItemId, number | undefined]>).forEach(
    ([resourceId, quantity]) => {
      const qty = quantity ?? 0;
      if (qty > 0 && requiresPostRunRouting(resourceId, qty, ctx)) {
        specialStacks += qty;
      }
    },
  );

  if (specialStacks <= 0) return [];
  return [`> SPECIAL CARGO: ${specialStacks} stack(s) — post-run routing on extract`];
}

export function formatCargoRoutingExtractionReviewLine(
  specialCargoStacks: number,
): string | null {
  if (specialCargoStacks <= 0) return null;
  return `Special cargo (${specialCargoStacks} stack${specialCargoStacks === 1 ? '' : 's'}) will require post-run routing on extract.`;
}
