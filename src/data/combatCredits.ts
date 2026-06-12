/** Run credit economy — tuned for consumable conservation and depth scaling. */

import { getDistrictFromDepth } from './districtPacing';

export const RUN_CREDIT_STANDARD_KILL_MIN = 15;
export const RUN_CREDIT_STANDARD_KILL_MAX = 25;

export const RUN_CREDIT_ELITE_KILL_MIN = 65;
export const RUN_CREDIT_ELITE_KILL_MAX = 80;

export const RUN_CREDIT_DISTRICT_BOSS_MIN = 75;
export const RUN_CREDIT_DISTRICT_BOSS_MAX = 100;

export const RUN_CREDIT_PRIME_BOSS_MIN = 100;
export const RUN_CREDIT_PRIME_BOSS_MAX = 120;

/** Narrative node — successful attribute check / resolver payout. */
export const RUN_CREDIT_NARRATIVE_SUCCESS = 35;

/** Narrative node — failed gamble (no credits). */
export const RUN_CREDIT_NARRATIVE_FAILURE = 0;

export function rollCreditReward(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

/** Flat multiplier by district depth layer (rounded down after apply). */
export function depthCreditMultiplier(depth: number): number {
  switch (getDistrictFromDepth(depth)) {
    case 1:
      return 1.0;
    case 2:
      return 1.5;
    case 3:
      return 2.0;
    default:
      return 1.0;
  }
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
