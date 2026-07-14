/** Run credit economy — values sourced from balance/rewardBalanceConfig. */

import { getDistrictFromDepth } from './districtPacing';
import {
  REWARD_CREDIT_RANGES,
  REWARD_DEPTH_CREDIT_MULTIPLIER,
} from './balance/rewardBalanceConfig';

export const RUN_CREDIT_STANDARD_KILL_MIN = REWARD_CREDIT_RANGES.standardKill.min;
export const RUN_CREDIT_STANDARD_KILL_MAX = REWARD_CREDIT_RANGES.standardKill.max;

export const RUN_CREDIT_ELITE_KILL_MIN = REWARD_CREDIT_RANGES.eliteKill.min;
export const RUN_CREDIT_ELITE_KILL_MAX = REWARD_CREDIT_RANGES.eliteKill.max;

export const RUN_CREDIT_DISTRICT_BOSS_MIN = REWARD_CREDIT_RANGES.districtBoss.min;
export const RUN_CREDIT_DISTRICT_BOSS_MAX = REWARD_CREDIT_RANGES.districtBoss.max;

export const RUN_CREDIT_PRIME_BOSS_MIN = REWARD_CREDIT_RANGES.primeBoss.min;
export const RUN_CREDIT_PRIME_BOSS_MAX = REWARD_CREDIT_RANGES.primeBoss.max;

/** Narrative node — successful attribute check / resolver payout. */
export const RUN_CREDIT_NARRATIVE_SUCCESS = REWARD_CREDIT_RANGES.narrativeSuccess;

/** Narrative node — failed gamble (no credits). */
export const RUN_CREDIT_NARRATIVE_FAILURE = REWARD_CREDIT_RANGES.narrativeFailure;

/** Baseline resolver payout when JSON/catalog copy omits an explicit credit line. */
export function defaultNarrativeResolverCredits(): number {
  return RUN_CREDIT_NARRATIVE_SUCCESS;
}

export function resolveNarrativeCreditPayout(
  parsedCredits: number,
  status: import('../types/game').CheckStatus,
): number {
  if (status === 'FAILURE') return 0;
  return parsedCredits > 0 ? parsedCredits : defaultNarrativeResolverCredits();
}

export function rollCreditReward(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Flat multiplier by district depth layer (rounded down after apply). */
export function depthCreditMultiplier(depth: number): number {
  const district = getDistrictFromDepth(depth);
  return REWARD_DEPTH_CREDIT_MULTIPLIER[district] ?? 1.0;
}

export function applyDepthCreditScaling(baseCredits: number, depth: number): number {
  if (baseCredits <= 0) return 0;
  return Math.floor(baseCredits * depthCreditMultiplier(depth));
}

export function standardKillCredits(depth: number): number {
  return applyDepthCreditScaling(
    rollCreditReward(RUN_CREDIT_STANDARD_KILL_MIN, RUN_CREDIT_STANDARD_KILL_MAX),
    depth,
  );
}

export function eliteKillCredits(depth: number): number {
  return applyDepthCreditScaling(
    rollCreditReward(RUN_CREDIT_ELITE_KILL_MIN, RUN_CREDIT_ELITE_KILL_MAX),
    depth,
  );
}

export function districtBossKillCredits(depth: number): number {
  return applyDepthCreditScaling(
    rollCreditReward(RUN_CREDIT_DISTRICT_BOSS_MIN, RUN_CREDIT_DISTRICT_BOSS_MAX),
    depth,
  );
}

export function primeBossKillCredits(depth: number): number {
  return applyDepthCreditScaling(
    rollCreditReward(RUN_CREDIT_PRIME_BOSS_MIN, RUN_CREDIT_PRIME_BOSS_MAX),
    depth,
  );
}

export function narrativeSuccessCredits(depth: number): number {
  return applyDepthCreditScaling(RUN_CREDIT_NARRATIVE_SUCCESS, depth);
}
