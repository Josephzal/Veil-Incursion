import type {
  OperationCompletionEffect,
  OperationContributionRules,
  OperationObjectiveKind,
  RewardEmphasis,
  SectorId,
  VeilAnchorType,
} from '../types/worldState';
import { OPERATION_CONTRIBUTION_VALUES } from './worldStateHelpers';
import { getSectorWorldTemplate } from './sectorWorldCatalog';

export function resolveContributionRules(
  objectiveKind: OperationObjectiveKind,
): OperationContributionRules {
  const v = OPERATION_CONTRIBUTION_VALUES;

  switch (objectiveKind) {
    case 'ANCHOR_ASSAULT':
      return {
        clearOperationTarget: v.clearOperationTarget,
        defeatAnchorElite: v.defeatAnchorElite,
        clearAnchorCore: v.clearAnchorCore,
        defeatDepthBoss: v.defeatDepthBoss,
        extractTargetResource: v.extractTargetResourceStack,
      };
    case 'ECHO_RECOVERY':
      return {
        clearOperationTarget: v.clearOperationTarget,
        extractTargetResource: v.extractTargetResourceStack,
      };
    case 'EXTRACTION_SURGE':
      return {
        successfulExtraction: v.successfulExtraction,
        emergencyRecallExtraction: v.emergencyRecallExtraction,
        bankAtSafehouse: v.bankAtSafehouse,
        extractTargetResource: v.extractTargetResourceStack,
      };
    case 'RESOURCE_SURVEY':
      return {
        extractTargetResource: v.extractTargetResourceStack,
        clearOperationTarget: v.clearOperationTarget,
      };
    case 'BOSS_SUPPRESSION':
      return {
        defeatElite: v.defeatElite,
        defeatDepthBoss: v.defeatDepthBoss,
        clearOperationTarget: v.clearOperationTarget,
        defeatEcho: v.defeatEcho,
      };
    default:
      return { successfulExtraction: v.successfulExtraction };
  }
}

export function resolveCompletionEffect(
  objectiveKind: OperationObjectiveKind,
  sectorId: SectorId,
  linkedAnchorId?: string,
): OperationCompletionEffect {
  const template = getSectorWorldTemplate(sectorId);
  const resourceFocus = template.resourceFocus[0];

  switch (objectiveKind) {
    case 'ANCHOR_ASSAULT':
      return {
        rotateToNextOperation: true,
        deactivateAnchorForRuns: linkedAnchorId ? 5 : undefined,
        increaseRewardLevelForRuns: 2,
        unlockResourceFocus: resourceFocus,
      };
    case 'ECHO_RECOVERY':
      return {
        rotateToNextOperation: true,
        deactivateAnchorForRuns: linkedAnchorId ? 4 : undefined,
        increaseRewardLevelForRuns: 2,
      };
    case 'EXTRACTION_SURGE':
      return {
        rotateToNextOperation: true,
        increaseRewardLevelForRuns: 4,
      };
    case 'RESOURCE_SURVEY':
      return {
        rotateToNextOperation: true,
        increaseRewardLevelForRuns: 2,
        unlockResourceFocus: resourceFocus,
        unlockTemporarySectorModifier: 'scanner-resource-visibility',
      };
    case 'BOSS_SUPPRESSION':
      return {
        rotateToNextOperation: true,
        deactivateAnchorForRuns: linkedAnchorId ? 3 : undefined,
        increaseRewardLevelForRuns: 3,
      };
    default:
      return {
        rotateToNextOperation: true,
        increaseRewardLevelForRuns: 2,
      };
  }
}

export function describeCompletionEffectLines(
  objectiveKind: OperationObjectiveKind,
  anchorDisplayName: string,
  effect: OperationCompletionEffect,
): string[] {
  const lines: string[] = [];

  switch (objectiveKind) {
    case 'ANCHOR_ASSAULT':
      if (effect.deactivateAnchorForRuns) {
        lines.push(`>> ${anchorDisplayName.toUpperCase()} SIGNAL SUPPRESSED — ANCHOR PRESSURE REDUCED FOR ${effect.deactivateAnchorForRuns} RUNS.`);
      }
      if (effect.increaseRewardLevelForRuns) {
        lines.push(`>> RARE RESOURCE REWARD BOOST — +1 REWARD LEVEL FOR ${effect.increaseRewardLevelForRuns} RUNS.`);
      }
      break;
    case 'ECHO_RECOVERY':
      if (effect.deactivateAnchorForRuns) {
        lines.push(`>> ECHO ACTIVITY CALMED — RESIDUAL BLEED SUPPRESSED FOR ${effect.deactivateAnchorForRuns} RUNS.`);
      }
      if (effect.increaseRewardLevelForRuns) {
        lines.push(`>> ECHO RESOURCE YIELD IMPROVED FOR ${effect.increaseRewardLevelForRuns} RUNS.`);
      }
      break;
    case 'EXTRACTION_SURGE':
      if (effect.increaseRewardLevelForRuns) {
        lines.push(`>> EXTRACTION SURGE — SECTOR RESOURCE REWARDS ELEVATED FOR ${effect.increaseRewardLevelForRuns} RUNS.`);
      }
      break;
    case 'RESOURCE_SURVEY':
      if (effect.unlockTemporarySectorModifier) {
        lines.push('>> SCANNER VISIBILITY IMPROVED — RESOURCE SIGNALS EASIER TO READ NEXT RUN.');
      }
      if (effect.increaseRewardLevelForRuns) {
        lines.push(`>> SURVEY PAYOUT — +1 REWARD LEVEL FOR ${effect.increaseRewardLevelForRuns} RUNS.`);
      }
      break;
    case 'BOSS_SUPPRESSION':
      if (effect.deactivateAnchorForRuns) {
        lines.push(`>> ELITE NEST PRESSURE REDUCED — NEST FEED DAMPENED FOR ${effect.deactivateAnchorForRuns} RUNS.`);
      }
      if (effect.increaseRewardLevelForRuns) {
        lines.push(`>> BOSS REWARD BIAS IMPROVED FOR ${effect.increaseRewardLevelForRuns} RUNS.`);
      }
      break;
    default:
      break;
  }

  if (effect.unlockResourceFocus) {
    lines.push(`>> RESOURCE FOCUS UNLOCKED — ${effect.unlockResourceFocus.toUpperCase()}.`);
  }

  return lines;
}

export function resolveProceduralRewardEmphasis(
  objectiveKind: OperationObjectiveKind,
  resourceFocus: readonly string[],
  _anchorType: VeilAnchorType | null,
): RewardEmphasis {
  const primary = resourceFocus[0];
  const secondary = resourceFocus[1];

  switch (objectiveKind) {
    case 'ANCHOR_ASSAULT':
      return { rareLoot: 0.15, echoCores: 1 };
    case 'ECHO_RECOVERY':
      return {
        echoCores: 2,
        credits: 0.1,
        targetResources: secondary ? [secondary] : undefined,
      };
    case 'EXTRACTION_SURGE':
      return { credits: 0.15, rareLoot: 0.1, targetResources: primary ? [primary] : undefined };
    case 'RESOURCE_SURVEY':
      return {
        targetResources: primary ? [primary, ...(secondary ? [secondary] : [])] : undefined,
        rareLoot: 0.1,
      };
    case 'BOSS_SUPPRESSION':
      return { rareLoot: 0.25, echoCores: 1 };
    default:
      return { rareLoot: 0.1 };
  }
}

export function formatOperationRewardPreview(
  rewardEmphasis: RewardEmphasis,
): string {
  const parts: string[] = [];
  if (rewardEmphasis.targetResources?.length) {
    parts.push(rewardEmphasis.targetResources.join(', '));
  }
  if (rewardEmphasis.rareLoot && rewardEmphasis.rareLoot > 0) {
    parts.push(`+${Math.round(rewardEmphasis.rareLoot * 100)}% rare loot`);
  }
  if (rewardEmphasis.echoCores && rewardEmphasis.echoCores > 0) {
    parts.push(`+${rewardEmphasis.echoCores} echo core${rewardEmphasis.echoCores === 1 ? '' : 's'}`);
  }
  if (rewardEmphasis.credits && rewardEmphasis.credits > 0) {
    parts.push(`+${Math.round(rewardEmphasis.credits * 100)}% credits`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'Sector completion surge';
}
