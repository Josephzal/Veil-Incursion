/**
 * Credit + composition reward scaling — combat kill payouts and tier bumps.
 */

import type { EncounterRewardTier } from '../../types/encounterComposition';

/** Standard combat kill credit range before depth multiplier. */
export const REWARD_CREDIT_RANGES = {
  standardKill: { min: 15, max: 25 },
  eliteKill: { min: 65, max: 80 },
  districtBoss: { min: 75, max: 100 },
  primeBoss: { min: 100, max: 120 },
  narrativeSuccess: 35,
  narrativeFailure: 0,
} as const;

/** Flat credit multiplier by district depth layer. */
export const REWARD_DEPTH_CREDIT_MULTIPLIER: Record<1 | 2 | 3, number> = {
  1: 1.0,
  2: 1.5,
  3: 2.0,
};

/** Composition reward-tier credit multipliers (after depth scaling). */
export const REWARD_COMPOSITION_CREDIT_MULTIPLIER: Record<EncounterRewardTier, number> = {
  BASELINE: 1.0,
  IMPROVED: 1.12,
  HIGH_VALUE: 1.22,
  RARE: 1.35,
  APEX_CHANCE: 1.45,
};

/** Extra rare-loot roll chance % baked into salvage by composition tier. */
export const REWARD_COMPOSITION_RARE_LOOT_BONUS_PCT: Record<EncounterRewardTier, number> = {
  BASELINE: 0,
  IMPROVED: 8,
  HIGH_VALUE: 16,
  RARE: 28,
  APEX_CHANCE: 40,
};

/**
 * Intent notes for drop pressure (actual pools live in combatRewardEngine /
 * resourceDropIdentityEngine — Phase C wires more of these as chance tables).
 */
export const REWARD_DROP_INTENT = {
  unstableCargoChanceByDepth: 'Sparse D1 → meaningful D2 → primary apex chance D3',
  intelChanceByDepth: 'Grid-Drive / Ledger climb with depth + Blackline',
  contrabandChanceByDepth: 'Casket/Jar — D2+ HV / Blacksite contexts',
  highRiskRewardMultiplier: 'Composition HIGH_VALUE / RARE / APEX_CHANCE should outpay BASELINE',
  eliteRewardMultiplier: 'Elite kill credits + faction rare pools',
  bossRewardMultiplier: 'District/prime boss credit ranges above',
} as const;

export function compositionCreditMultiplierFromConfig(
  tier: EncounterRewardTier | null | undefined,
): number {
  if (!tier) return 1.0;
  return REWARD_COMPOSITION_CREDIT_MULTIPLIER[tier] ?? 1.0;
}

export function compositionRareLootBonusPctFromConfig(
  tier: EncounterRewardTier | null | undefined,
): number {
  if (!tier) return 0;
  return REWARD_COMPOSITION_RARE_LOOT_BONUS_PCT[tier] ?? 0;
}

export function formatRewardBalanceConfigSummary(): string {
  const c = REWARD_CREDIT_RANGES;
  return [
    'REWARD BALANCE CONFIG',
    `  std kill: ${c.standardKill.min}–${c.standardKill.max}`,
    `  elite: ${c.eliteKill.min}–${c.eliteKill.max}`,
    `  district boss: ${c.districtBoss.min}–${c.districtBoss.max}`,
    `  prime boss: ${c.primeBoss.min}–${c.primeBoss.max}`,
    `  depth credit ×: D1=${REWARD_DEPTH_CREDIT_MULTIPLIER[1]} D2=${REWARD_DEPTH_CREDIT_MULTIPLIER[2]} D3=${REWARD_DEPTH_CREDIT_MULTIPLIER[3]}`,
  ].join('\n');
}
