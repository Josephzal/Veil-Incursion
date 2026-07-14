/**
 * Contract payout / sponsor modifiers — used by contractTemplates.rewardFor helpers.
 */

import type { CabalEmployerId } from '../../types/worldState';
import type { ContractRewardPackage } from '../../types/contract';

/** Base credits = base + difficulty * perDifficulty. Reputation is fixed per table row. */
export const CONTRACT_REWARD_TABLE: Record<
  string,
  { creditBase: number; creditPerDifficulty: number; reputation: number }
> = {
  EXTRACT_STABLE_RESOURCE: { creditBase: 80, creditPerDifficulty: 20, reputation: 2 },
  EXTRACT_SPONSOR_RESOURCE: { creditBase: 120, creditPerDifficulty: 25, reputation: 3 },
  RECOVER_INTEL: { creditBase: 150, creditPerDifficulty: 30, reputation: 4 },
  RECOVER_ECONOMY_INTEL: { creditBase: 140, creditPerDifficulty: 25, reputation: 3 },
  EXTRACT_UNSTABLE_CARGO: { creditBase: 160, creditPerDifficulty: 30, reputation: 4 },
  RECOVER_APEX_CARGO: { creditBase: 250, creditPerDifficulty: 40, reputation: 6 },
  RECOVER_CONTRABAND: { creditBase: 180, creditPerDifficulty: 35, reputation: 4 },
  DEFEAT_ELITE: { creditBase: 100, creditPerDifficulty: 20, reputation: 3 },
  COMPLETE_EMERGENCY_RECALL: { creditBase: 110, creditPerDifficulty: 25, reputation: 3 },
  DEFEAT_DEPTH_BOSS: { creditBase: 140, creditPerDifficulty: 30, reputation: 4 },
  REACH_DEPTH_AND_EXTRACT: { creditBase: 90, creditPerDifficulty: 20, reputation: 2 },
  CLEAR_OPERATION_TARGET: { creditBase: 120, creditPerDifficulty: 25, reputation: 3 },
};

export const CONTRACT_SPONSOR_MODIFIERS: Record<
  CabalEmployerId,
  { creditMult: number; reputationBonus: number; rareLootBonusPct: number }
> = {
  TERRAN_GRID: { creditMult: 1.0, reputationBonus: 0, rareLootBonusPct: 0 },
  LEGION: { creditMult: 0.9, reputationBonus: 0, rareLootBonusPct: 5 },
  SOLARIS: { creditMult: 1.1, reputationBonus: 1, rareLootBonusPct: 8 },
};

/** Emergency-recall contract gets an extra rare-loot bump on completion reward. */
export const CONTRACT_EMERGENCY_RECALL_RARE_LOOT_PCT = 8;

/**
 * Intent targets (telemetry Phase B):
 * - Easy contracts complete often with focus
 * - Medium need risk / depth
 * - Hard usually need D2/D3 or specific cargo
 */
export const CONTRACT_COMPLETION_INTENT = {
  easyOften: true,
  mediumNeedsRisk: true,
  hardNeedsDepthOrSpecificCargo: true,
  noContractRunsViable: true,
} as const;

export function buildContractRewardPackage(
  sponsorId: CabalEmployerId,
  credits: number,
  reputation: number,
): ContractRewardPackage {
  const mod = CONTRACT_SPONSOR_MODIFIERS[sponsorId];
  return {
    credits: Math.round(credits * mod.creditMult),
    reputation: reputation + mod.reputationBonus,
    rareLootBonusPct: mod.rareLootBonusPct,
  };
}

export function contractCreditsForKind(kind: string, difficulty: number): {
  credits: number;
  reputation: number;
} {
  const row = CONTRACT_REWARD_TABLE[kind];
  if (!row) {
    return { credits: 80 + difficulty * 20, reputation: 2 };
  }
  return {
    credits: row.creditBase + difficulty * row.creditPerDifficulty,
    reputation: row.reputation,
  };
}

export function formatContractBalanceConfigSummary(): string {
  return [
    'CONTRACT BALANCE CONFIG',
    ...Object.entries(CONTRACT_REWARD_TABLE).map(
      ([kind, row]) => `  ${kind}: ${row.creditBase}+${row.creditPerDifficulty}×d / rep ${row.reputation}`,
    ),
    '  sponsors: GRID×1.0 / LEGION×0.9+5%rare / SOLARIS×1.1+1rep+8%rare',
  ].join('\n');
}
