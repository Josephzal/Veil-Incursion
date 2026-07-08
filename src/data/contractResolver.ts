import type {
  ActiveRunContract,
  ContractBonusObjective,
  ContractExtractionKind,
  ContractResult,
  ContractRunProgress,
} from '../types/contract';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import type { RunResourceLedger } from '../types/runResourceLedger';
import { getResourceCategory, getResourceDisplayName, RESOURCE_REGISTRY } from './resourceRegistry';
import { mergeResourceQuantities } from './runResourceLedgerEngine';

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

  const quantityRequired = contract.targetQuantity ?? 1;
  const resolvedResources = countResolvedResources(ledger);
  const targetCount = countResourceTargets(resolvedResources, contract);
  const resolvedExtractionKind = inferExtractionKind(progress, { extractionKind });
  let succeeded = false;
  let progressText = '';

  switch (contract.objectiveKind) {
    case 'EXTRACT_STABLE_RESOURCE':
    case 'EXTRACT_SPONSOR_RESOURCE':
    case 'RECOVER_INTEL':
    case 'RECOVER_ECONOMY_INTEL':
    case 'EXTRACT_UNSTABLE_CARGO':
    case 'RECOVER_APEX_CARGO':
    case 'RECOVER_CONTRABAND':
      succeeded = extractedSuccessfully && targetCount >= quantityRequired;
      progressText = `${resourceTargetLabel(contract)}: ${targetCount}/${quantityRequired} banked or extracted`;
      break;
    case 'DEFEAT_ELITE': {
      const required = contract.requiredEliteKills ?? 1;
      succeeded = extractedSuccessfully && progress.eliteKills >= required;
      progressText = `Elite kills: ${progress.eliteKills}/${required}${extractedSuccessfully ? '' : ' // extraction required'}`;
      break;
    }
    case 'COMPLETE_EMERGENCY_RECALL':
      succeeded = extractedSuccessfully && progress.emergencyRecallCompleted;
      progressText = `Emergency Recall: ${progress.emergencyRecallCompleted ? 'completed' : 'not completed'}${extractedSuccessfully ? '' : ' // extraction required'}`;
      break;
    case 'DEFEAT_DEPTH_BOSS':
      succeeded = extractedSuccessfully && progress.depthBossDefeated;
      progressText = `Depth boss: ${progress.depthBossDefeated ? 'defeated' : 'not defeated'}${extractedSuccessfully ? '' : ' // extraction required'}`;
      break;
    case 'REACH_DEPTH_AND_EXTRACT': {
      const required = contract.requiredDepth ?? 2;
      succeeded = extractedSuccessfully && progress.highestDepthReached >= required;
      progressText = `Depth reached: ${progress.highestDepthReached}/${required}${extractedSuccessfully ? '' : ' // extraction required'}`;
      break;
    }
    case 'CLEAR_OPERATION_TARGET': {
      const required = contract.requiredOperationTargets ?? 1;
      succeeded = extractedSuccessfully && progress.operationTargetsCleared >= required;
      progressText = `Operation targets: ${progress.operationTargetsCleared}/${required}${extractedSuccessfully ? '' : ' // extraction required'}`;
      break;
    }
    default:
      progressText = 'Unsupported objective.';
      succeeded = false;
      break;
  }

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
        resolvedExtractionKind,
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

  return {
    status: succeeded ? 'SUCCESS' : 'FAILED',
    title: contract.title,
    sponsorId: contract.sponsorId,
    objectiveText: contract.objectiveText,
    progressText,
    reward: contract.reward,
    reputationAwarded: succeeded ? (contract.reward?.reputation ?? 0) : 0,
    creditsAwarded: succeeded ? (contract.reward?.credits ?? 0) : 0,
    resourceBonusIds: succeeded ? resourceBonusIdsFor(contract) : [],
    bonusObjectiveMet,
    bonusObjectiveText,
    bonusProgressText,
    bonusCreditsAwarded,
    bonusReputationAwarded,
  };
}
