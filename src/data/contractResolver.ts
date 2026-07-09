import type {
  ActiveRunContract,
  ContractBonusObjective,
  ContractExtractionKind,
  ContractObjectiveKind,
  ContractResult,
  ContractRunProgress,
} from '../types/contract';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import type { RunResourceLedger } from '../types/runResourceLedger';
import { getResourceCategory, getResourceDisplayName, RESOURCE_REGISTRY } from './resourceRegistry';
import { mergeResourceQuantities } from './runResourceLedgerEngine';

const RESOURCE_CONTRACT_OBJECTIVES = new Set<ContractObjectiveKind>([
  'EXTRACT_STABLE_RESOURCE',
  'EXTRACT_SPONSOR_RESOURCE',
  'RECOVER_INTEL',
  'RECOVER_ECONOMY_INTEL',
  'EXTRACT_UNSTABLE_CARGO',
  'RECOVER_APEX_CARGO',
  'RECOVER_CONTRABAND',
]);

export function isResourceContractObjective(
  objectiveKind: ContractObjectiveKind,
): boolean {
  return RESOURCE_CONTRACT_OBJECTIVES.has(objectiveKind);
}

function countResourceTargets(
  resources: ResourceQuantity,
  contract: ActiveRunContract,
): number {
  const targetIds = new Set<ResourceItemId>();
  if (contract.targetResourceId) targetIds.add(contract.targetResourceId);
  contract.targetResourceOptions?.forEach((id) => targetIds.add(id));

  if (targetIds.size > 0) {
    return [...targetIds].reduce((sum, resourceId) => sum + (resources[resourceId] ?? 0), 0);
  }

  if (contract.targetCategory) {
    return (Object.entries(resources) as Array<[ResourceItemId, number | undefined]>)
      .filter(([resourceId]) => getResourceCategory(resourceId) === contract.targetCategory)
      .reduce((sum, [, quantity]) => sum + (quantity ?? 0), 0);
  }

  return 0;
}

function countResolvedResources(ledger: RunResourceLedger): ResourceQuantity {
  const resolved = mergeResourceQuantities(ledger.extracted, ledger.bankedAtSafehouse);
  return (Object.entries(resolved) as Array<[ResourceItemId, number | undefined]>)
    .reduce<ResourceQuantity>((acc, [resourceId, quantity]) => {
      const extracted = ledger.extracted[resourceId] ?? 0;
      const banked = ledger.bankedAtSafehouse[resourceId] ?? 0;
      acc[resourceId] = Math.max(extracted, banked, quantity ?? 0);
      return acc;
    }, {});
}

function resourceTargetLabel(contract: ActiveRunContract): string {
  if (contract.targetResourceId) return getResourceDisplayName(contract.targetResourceId, true);
  if (contract.targetResourceOptions?.length) {
    return contract.targetResourceOptions
      .map((id) => getResourceDisplayName(id, true))
      .join(' / ');
  }
  if (contract.targetCategory) return `${contract.targetCategory.toLowerCase()} cargo`;
  return 'contract cargo';
}

function resourceBonusIdsFor(contract: ActiveRunContract): ResourceItemId[] {
  return (contract.reward?.resourceBonusIds ?? [])
    .filter((id): id is ResourceItemId => id in RESOURCE_REGISTRY);
}

function evaluateBonusObjective(
  bonus: ContractBonusObjective,
  progress: ContractRunProgress,
  extractionKind: ContractExtractionKind,
): { met: boolean; progressText: string } {
  switch (bonus.kind) {
    case 'SAFE_EXTRACTION':
      return {
        met: extractionKind === 'SAFE_ANCHOR' || extractionKind === 'MASTER_LINK',
        progressText: extractionKind === 'EMERGENCY_RECALL'
          ? 'Emergency Recall used — bonus unavailable'
          : extractionKind === 'STANDARD'
            ? 'Standard extraction — clean evac bonus missed'
            : 'Clean extraction confirmed',
      };
    case 'EARLY_EXTRACTION':
      return {
        met: progress.highestDepthReached < 3,
        progressText: `Depth at extract: ${progress.highestDepthReached} (need before Depth 3)`,
      };
    case 'ELITE_KILL':
      return {
        met: progress.depthBossDefeated,
        progressText: progress.depthBossDefeated
          ? 'Depth boss defeated'
          : 'Depth boss not defeated',
      };
    case 'DEPTH_EXTRACT':
      return {
        met: progress.highestDepthReached >= 3,
        progressText: `Depth reached: ${progress.highestDepthReached}/3`,
      };
    case 'ANOMALY_CLEAR':
      return {
        met: progress.anomaliesCleared > 0,
        progressText: `Anomalies cleared: ${progress.anomaliesCleared}`,
      };
    default:
      return { met: false, progressText: 'Bonus objective unsupported.' };
  }
}

function inferExtractionKind(
  progress: ContractRunProgress,
  opts?: { extractionKind?: ContractExtractionKind },
): ContractExtractionKind {
  if (opts?.extractionKind) return opts.extractionKind;
  if (progress.emergencyRecallCompleted) return 'EMERGENCY_RECALL';
  return 'STANDARD';
}

interface ContractEvaluationInput {
  contract: ActiveRunContract;
  progress: ContractRunProgress;
  extractedSuccessfully: boolean;
  extractionKind: ContractExtractionKind;
  resourceQuantity: ResourceQuantity;
  useDeliveredResources: boolean;
}

function evaluateContractOutcome(input: ContractEvaluationInput): {
  succeeded: boolean;
  progressText: string;
} {
  const { contract, progress, extractedSuccessfully, extractionKind } = input;
  const quantityRequired = contract.targetQuantity ?? 1;
  const targetCount = countResourceTargets(input.resourceQuantity, contract);

  switch (contract.objectiveKind) {
    case 'EXTRACT_STABLE_RESOURCE':
    case 'EXTRACT_SPONSOR_RESOURCE':
    case 'RECOVER_INTEL':
    case 'RECOVER_ECONOMY_INTEL':
    case 'EXTRACT_UNSTABLE_CARGO':
    case 'RECOVER_APEX_CARGO':
    case 'RECOVER_CONTRABAND':
      return {
        succeeded: extractedSuccessfully && targetCount >= quantityRequired,
        progressText: input.useDeliveredResources
          ? `${resourceTargetLabel(contract)}: ${targetCount}/${quantityRequired} delivered to sponsor`
          : `${resourceTargetLabel(contract)}: ${targetCount}/${quantityRequired} banked or extracted`,
      };
    case 'DEFEAT_ELITE': {
      const required = contract.requiredEliteKills ?? 1;
      return {
        succeeded: extractedSuccessfully && progress.eliteKills >= required,
        progressText: `Elite kills: ${progress.eliteKills}/${required}${extractedSuccessfully ? '' : ' // extraction required'}`,
      };
    }
    case 'COMPLETE_EMERGENCY_RECALL':
      return {
        succeeded: extractedSuccessfully && progress.emergencyRecallCompleted,
        progressText: `Emergency Recall: ${progress.emergencyRecallCompleted ? 'completed' : 'not completed'}${extractedSuccessfully ? '' : ' // extraction required'}`,
      };
    case 'DEFEAT_DEPTH_BOSS':
      return {
        succeeded: extractedSuccessfully && progress.depthBossDefeated,
        progressText: `Depth boss: ${progress.depthBossDefeated ? 'defeated' : 'not defeated'}${extractedSuccessfully ? '' : ' // extraction required'}`,
      };
    case 'REACH_DEPTH_AND_EXTRACT': {
      const required = contract.requiredDepth ?? 2;
      return {
        succeeded: extractedSuccessfully && progress.highestDepthReached >= required,
        progressText: `Depth reached: ${progress.highestDepthReached}/${required}${extractedSuccessfully ? '' : ' // extraction required'}`,
      };
    }
    case 'CLEAR_OPERATION_TARGET': {
      const required = contract.requiredOperationTargets ?? 1;
      return {
        succeeded: extractedSuccessfully && progress.operationTargetsCleared >= required,
        progressText: `Operation targets: ${progress.operationTargetsCleared}/${required}${extractedSuccessfully ? '' : ' // extraction required'}`,
      };
    }
    default:
      return {
        succeeded: false,
        progressText: 'Unsupported objective.',
      };
  }
}

function buildContractResult({
  contract,
  progress,
  extractedSuccessfully,
  extractionKind,
  succeeded,
  progressText,
  statusOverride,
}: {
  contract: ActiveRunContract;
  progress: ContractRunProgress;
  extractedSuccessfully: boolean;
  extractionKind: ContractExtractionKind;
  succeeded: boolean;
  progressText: string;
  statusOverride?: ContractResult['status'];
}): ContractResult {
  const emptyBonus = {
    bonusObjectiveMet: false,
    bonusCreditsAwarded: 0,
    bonusReputationAwarded: 0,
  };

  let bonusObjectiveMet = false;
  let bonusObjectiveText: string | undefined;
  let bonusProgressText: string | undefined;
  let bonusCreditsAwarded = 0;
  let bonusReputationAwarded = 0;

  if (succeeded && contract.bonusObjectiveText && contract.bonusReward) {
    const bonusKind = contract.bonusObjectiveKind;
    if (bonusKind) {
      const bonusEval = evaluateBonusObjective(
        { text: contract.bonusObjectiveText, kind: bonusKind },
        progress,
        extractionKind,
      );
      bonusObjectiveText = contract.bonusObjectiveText;
      bonusProgressText = bonusEval.progressText;
      bonusObjectiveMet = bonusEval.met;
      if (bonusObjectiveMet) {
        bonusCreditsAwarded = contract.bonusReward.credits ?? 0;
        bonusReputationAwarded = contract.bonusReward.reputation ?? 0;
      }
    }
  }

  const status = statusOverride ?? (succeeded ? 'SUCCESS' : 'FAILED');
  const awardsGranted = status === 'SUCCESS';

  return {
    status,
    title: contract.title,
    sponsorId: contract.sponsorId,
    objectiveText: contract.objectiveText,
    progressText,
    reward: contract.reward,
    reputationAwarded: awardsGranted ? (contract.reward?.reputation ?? 0) : 0,
    creditsAwarded: awardsGranted ? (contract.reward?.credits ?? 0) : 0,
    resourceBonusIds: awardsGranted ? resourceBonusIdsFor(contract) : [],
    bonusObjectiveMet,
    bonusObjectiveText,
    bonusProgressText,
    bonusCreditsAwarded: awardsGranted ? bonusCreditsAwarded : 0,
    bonusReputationAwarded: awardsGranted ? bonusReputationAwarded : 0,
  };
}

export function resolveContractPendingDelivery({
  contract,
  ledger,
  progress,
  extractionKind,
}: {
  contract: ActiveRunContract | null;
  ledger: RunResourceLedger;
  progress: ContractRunProgress;
  extractionKind?: ContractExtractionKind;
}): ContractResult {
  const emptyBonus = {
    bonusObjectiveMet: false,
    bonusCreditsAwarded: 0,
    bonusReputationAwarded: 0,
  };

  if (!contract?.contractId || !contract.objectiveKind) {
    return {
      status: 'NONE',
      title: 'Independent Breach',
      sponsorId: null,
      objectiveText: 'No sponsor contract selected.',
      progressText: 'Base sector rewards only.',
      reward: null,
      reputationAwarded: 0,
      creditsAwarded: 0,
      resourceBonusIds: [],
      ...emptyBonus,
    };
  }

  const resolvedExtractionKind = inferExtractionKind(progress, { extractionKind });
  const resolvedResources = countResolvedResources(ledger);
  const quantityRequired = contract.targetQuantity ?? 1;
  const availableCount = countResourceTargets(resolvedResources, contract);

  if (
    contract.objectiveKind
    && isResourceContractObjective(contract.objectiveKind)
    && availableCount >= quantityRequired
  ) {
    return buildContractResult({
      contract,
      progress,
      extractedSuccessfully: true,
      extractionKind: resolvedExtractionKind,
      succeeded: false,
      progressText: `${resourceTargetLabel(contract)}: ${availableCount}/${quantityRequired} recovered — awaiting sponsor delivery`,
      statusOverride: 'PENDING_DELIVERY',
    });
  }

  return resolveContractResult({
    contract,
    ledger,
    progress,
    extractedSuccessfully: true,
    extractionKind,
  });
}

export function resolveContractAfterRouting({
  contract,
  progress,
  deliveredResources,
  extractedSuccessfully,
  extractionKind,
  skipResourceDelivery = false,
}: {
  contract: ActiveRunContract | null;
  progress: ContractRunProgress;
  deliveredResources: ResourceQuantity;
  extractedSuccessfully: boolean;
  extractionKind?: ContractExtractionKind;
  skipResourceDelivery?: boolean;
}): ContractResult {
  const emptyBonus = {
    bonusObjectiveMet: false,
    bonusCreditsAwarded: 0,
    bonusReputationAwarded: 0,
  };

  if (!contract?.contractId || !contract.objectiveKind) {
    return {
      status: 'NONE',
      title: 'Independent Breach',
      sponsorId: null,
      objectiveText: 'No sponsor contract selected.',
      progressText: 'Base sector rewards only.',
      reward: null,
      reputationAwarded: 0,
      creditsAwarded: 0,
      resourceBonusIds: [],
      ...emptyBonus,
    };
  }

  const resolvedExtractionKind = inferExtractionKind(progress, { extractionKind });
  const resourceQuantity = skipResourceDelivery || !isResourceContractObjective(contract.objectiveKind)
    ? {}
    : deliveredResources;
  const evaluation = evaluateContractOutcome({
    contract,
    progress,
    extractedSuccessfully,
    extractionKind: resolvedExtractionKind,
    resourceQuantity,
    useDeliveredResources: !skipResourceDelivery && isResourceContractObjective(contract.objectiveKind),
  });

  return buildContractResult({
    contract,
    progress,
    extractedSuccessfully,
    extractionKind: resolvedExtractionKind,
    succeeded: evaluation.succeeded,
    progressText: evaluation.progressText,
  });
}

export function resolveContractResult({
  contract,
  ledger,
  progress,
  extractedSuccessfully,
  extractionKind,
}: {
  contract: ActiveRunContract | null;
  ledger: RunResourceLedger;
  progress: ContractRunProgress;
  extractedSuccessfully: boolean;
  extractionKind?: ContractExtractionKind;
}): ContractResult {
  const emptyBonus = {
    bonusObjectiveMet: false,
    bonusCreditsAwarded: 0,
    bonusReputationAwarded: 0,
  };

  if (!contract?.contractId || !contract.objectiveKind) {
    return {
      status: 'NONE',
      title: 'Independent Breach',
      sponsorId: null,
      objectiveText: 'No sponsor contract selected.',
      progressText: 'Base sector rewards only.',
      reward: null,
      reputationAwarded: 0,
      creditsAwarded: 0,
      resourceBonusIds: [],
      ...emptyBonus,
    };
  }

  const resolvedResources = countResolvedResources(ledger);
  const resolvedExtractionKind = inferExtractionKind(progress, { extractionKind });
  const evaluation = evaluateContractOutcome({
    contract,
    progress,
    extractedSuccessfully,
    extractionKind: resolvedExtractionKind,
    resourceQuantity: resolvedResources,
    useDeliveredResources: false,
  });

  return buildContractResult({
    contract,
    progress,
    extractedSuccessfully,
    extractionKind: resolvedExtractionKind,
    succeeded: evaluation.succeeded,
    progressText: evaluation.progressText,
  });
}
