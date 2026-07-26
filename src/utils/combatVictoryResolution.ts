import {
  districtBossKillCredits,
  eliteKillCredits,
  primeBossKillCredits,
  standardKillCredits,
} from '../data/combatCredits';
import {
  applyCompositionCreditScaling,
} from '../data/encounterCompositionRewardEngine';
import {
  bossFlavorCreditBonus,
  buildBossFlavorContextFromRun,
  resolveBossFlavorRewardTier,
} from '../data/encounterBossFlavorEngine';
import { getDistrictFromDepth, isPrimeBossDepth } from '../data/districtPacing';
import type { ActiveIncursionState, IncursionNode } from '../types/game';
import type { HarvestReturnRoute } from '../types/cargoGrid';

export type CombatVictoryKind = 'STANDARD' | 'ELITE' | 'BOSS' | 'EXTRACTION_DEFENSE';

export type CombatVictoryContinueDestination =
  | 'SCANNER'
  | 'POST_COMBAT_BOON'
  | 'RESOURCE_HARVEST'
  | 'EXTRACTION_REVIEW'
  | 'DEV_HUB';

export interface CombatVictoryCreditInput {
  activeIncursion: Pick<
    ActiveIncursionState,
    | 'bossProfile'
    | 'nodesCleared'
    | 'depthIdentity'
    | 'runGenerationContext'
  >;
  vectorNode: IncursionNode | null | undefined;
  isBossEncounter: boolean;
}

/** Heading copy keyed to encounter class — restrained for standard clears. */
export function resolveCombatVictoryHeading(kind: CombatVictoryKind): string {
  switch (kind) {
    case 'BOSS':
      return 'ANOMALY SIGNATURE EXTINGUISHED';
    case 'ELITE':
      return 'ELITE SIGNATURE EXTINGUISHED';
    case 'EXTRACTION_DEFENSE':
      return 'EXTRACTION WINDOW SECURED';
    default:
      return 'ENCOUNTER CLEARED';
  }
}

export function resolveCombatVictoryKind(input: {
  isBossEncounter: boolean;
  defendRiftActive: boolean;
  vectorNodeType?: string | null;
}): CombatVictoryKind {
  if (input.defendRiftActive) return 'EXTRACTION_DEFENSE';
  if (input.isBossEncounter) return 'BOSS';
  if (input.vectorNodeType === 'ELITE_COMBAT') return 'ELITE';
  return 'STANDARD';
}

/** Destination after dismiss — mirrors CombatScreen.handleCombatComplete routing. */
export function resolveCombatVictoryContinueDestination(input: {
  isDevExit: boolean;
  defendRiftActive: boolean;
  isBossEncounter: boolean;
  pendingAmbush: boolean;
  ambushHarvestRoute?: HarvestReturnRoute | null;
  boonBlocked: boolean;
}): CombatVictoryContinueDestination {
  if (input.isDevExit) return 'DEV_HUB';
  if (input.defendRiftActive) return 'EXTRACTION_REVIEW';
  if (input.pendingAmbush) {
    if (input.ambushHarvestRoute === 'POST_COMBAT') {
      return input.boonBlocked ? 'SCANNER' : 'POST_COMBAT_BOON';
    }
    return 'SCANNER';
  }
  if (input.isBossEncounter) return 'SCANNER';
  if (input.boonBlocked) return 'RESOURCE_HARVEST';
  return 'POST_COMBAT_BOON';
}

export function resolveCombatVictoryContinueLabel(
  destination: CombatVictoryContinueDestination,
): string {
  switch (destination) {
    case 'EXTRACTION_REVIEW':
      return '[ OPEN EXTRACTION REVIEW ]';
    case 'RESOURCE_HARVEST':
      return '[ ENTER HARVEST ]';
    case 'POST_COMBAT_BOON':
      return '[ CONTINUE RUN ]';
    case 'DEV_HUB':
      return '[ RETURN TO LAB ]';
    case 'SCANNER':
    default:
      return '[ RETURN TO SCANNER ]';
  }
}

/**
 * Same credit roll path as CombatScreen victory payout.
 * Call once when the banner appears and reuse on dismiss so the summary matches the award.
 */
export function computeCombatVictoryCreditReward(
  input: CombatVictoryCreditInput,
): number {
  const { activeIncursion, vectorNode, isBossEncounter } = input;
  const depth = activeIncursion.nodesCleared + 1;
  const mods = vectorNode?.contextModifiers;
  const compositionTier = mods?.compositionRewardTier ?? null;
  const bossFlavorCtx = isBossEncounter
    ? buildBossFlavorContextFromRun({
        depth: getDistrictFromDepth(depth),
        depthIdentity: activeIncursion.depthIdentity,
        anchorType: activeIncursion.runGenerationContext?.activeAnchor?.type
          ?? activeIncursion.runGenerationContext?.sectorState.activeAnchor?.type
          ?? null,
        operationKind: activeIncursion.runGenerationContext?.activeOperation.objectiveKind ?? null,
      })
    : null;
  const rewardTier = isBossEncounter && bossFlavorCtx
    ? resolveBossFlavorRewardTier(bossFlavorCtx)
    : compositionTier;
  const nodeType = vectorNode?.type;
  let creditReward = isBossEncounter
    ? (isPrimeBossDepth(depth) ? primeBossKillCredits(depth) : districtBossKillCredits(depth))
    : nodeType === 'ELITE_COMBAT'
      ? eliteKillCredits(depth)
      : standardKillCredits(depth);
  creditReward = applyCompositionCreditScaling(creditReward, rewardTier);
  if (bossFlavorCtx) {
    creditReward += bossFlavorCreditBonus(bossFlavorCtx);
  }
  return creditReward;
}
