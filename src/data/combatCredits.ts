/** Void-chit economy — tuned for ~200–250 credits by Depth 10 with aggressive exploration. */

export const RUN_CREDIT_STANDARD_KILL_MIN = 5;
export const RUN_CREDIT_STANDARD_KILL_MAX = 8;

export const RUN_CREDIT_ELITE_KILL_MIN = 10;
export const RUN_CREDIT_ELITE_KILL_MAX = 14;

export const RUN_CREDIT_DISTRICT_BOSS_MIN = 75;
export const RUN_CREDIT_DISTRICT_BOSS_MAX = 100;

export const RUN_CREDIT_PRIME_BOSS_MIN = 100;
export const RUN_CREDIT_PRIME_BOSS_MAX = 120;

export const RUN_CREDIT_NARRATIVE_MIN = 30;
export const RUN_CREDIT_NARRATIVE_MAX = 40;

export function rollCreditReward(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function standardKillCredits(): number {
  return rollCreditReward(RUN_CREDIT_STANDARD_KILL_MIN, RUN_CREDIT_STANDARD_KILL_MAX);
}

export function eliteKillCredits(): number {
  return rollCreditReward(RUN_CREDIT_ELITE_KILL_MIN, RUN_CREDIT_ELITE_KILL_MAX);
}

export function districtBossKillCredits(): number {
  return rollCreditReward(RUN_CREDIT_DISTRICT_BOSS_MIN, RUN_CREDIT_DISTRICT_BOSS_MAX);
}

export function primeBossKillCredits(): number {
  return rollCreditReward(RUN_CREDIT_PRIME_BOSS_MIN, RUN_CREDIT_PRIME_BOSS_MAX);
}

export function narrativeCheckCredits(): number {
  return rollCreditReward(RUN_CREDIT_NARRATIVE_MIN, RUN_CREDIT_NARRATIVE_MAX);
}
