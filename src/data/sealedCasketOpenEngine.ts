import type { AppraisalValueBand } from '../types/sealedCargo';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import { RESOURCE_REGISTRY } from './resourceRegistry';

export type CasketRewardTierId =
  | 'COMMON_CACHE'
  | 'UNCOMMON_CACHE'
  | 'RARE_TECH_CACHE'
  | 'UNSTABLE_CACHE'
  | 'APEX_CACHE'
  | 'DUD_CACHE';

export interface SealedCasketOpenReward {
  tierId: CasketRewardTierId;
  resources: ResourceQuantity;
  credits: number;
  summaryLabel: string;
  dudFlavor?: string;
}

export const SEALED_CASKET_REWARD_RESOURCE_IDS: readonly ResourceItemId[] = [
  'ley-slag',
  'echo-glass-shard',
  'sanguine-ampoule',
  'combustion-cylinder',
  'encrypted-grid-drive',
  'legion-blood-iron',
  'veil-ash-canister',
  'ossified-ley-knot',
  'anomalous-core',
];

const BASE_TIER_WEIGHTS: Record<CasketRewardTierId, number> = {
  COMMON_CACHE: 35,
  UNCOMMON_CACHE: 30,
  RARE_TECH_CACHE: 15,
  UNSTABLE_CACHE: 12,
  APEX_CACHE: 5,
  DUD_CACHE: 3,
};

const BAND_TIER_MODIFIERS: Record<AppraisalValueBand, Partial<Record<CasketRewardTierId, number>>> = {
  LOW_VALUE: {
    COMMON_CACHE: 20,
    DUD_CACHE: 10,
    APEX_CACHE: -4,
    RARE_TECH_CACHE: -5,
  },
  STANDARD_VALUE: {},
  HIGH_VALUE: {
    DUD_CACHE: -2,
    COMMON_CACHE: -8,
    RARE_TECH_CACHE: 6,
    UNSTABLE_CACHE: 4,
  },
  RARE_VALUE: {
    DUD_CACHE: -2,
    COMMON_CACHE: -10,
    RARE_TECH_CACHE: 8,
    UNSTABLE_CACHE: 8,
    APEX_CACHE: 3,
  },
  APEX_VALUE: {
    DUD_CACHE: -2,
    COMMON_CACHE: -12,
    UNCOMMON_CACHE: -5,
    APEX_CACHE: 10,
    UNSTABLE_CACHE: 5,
    RARE_TECH_CACHE: 4,
  },
};

let debugForcedTier: CasketRewardTierId | null = null;

export function setDebugForcedCasketTier(tier: CasketRewardTierId | null): void {
  debugForcedTier = tier;
}

function rollInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

function rollCredits(rng: () => number, min: number, max: number): number {
  return rollInt(rng, min, max);
}

const TIER_ROLLERS: Record<CasketRewardTierId, (rng: () => number) => SealedCasketOpenReward> = {
  COMMON_CACHE: (rng) => ({
    tierId: 'COMMON_CACHE',
    resources: {
      'ley-slag': rollInt(rng, 4, 8),
      'echo-glass-shard': rollInt(rng, 3, 6),
    },
    credits: rollCredits(rng, 50, 100),
    summaryLabel: 'Common cache',
  }),
  UNCOMMON_CACHE: (rng) => ({
    tierId: 'UNCOMMON_CACHE',
    resources: {
      'sanguine-ampoule': rollInt(rng, 1, 2),
      'combustion-cylinder': 1,
      'ley-slag': rollInt(rng, 3, 6),
    },
    credits: rollCredits(rng, 75, 150),
    summaryLabel: 'Uncommon cache',
  }),
  RARE_TECH_CACHE: (rng) => ({
    tierId: 'RARE_TECH_CACHE',
    resources: {
      'encrypted-grid-drive': 1,
      'legion-blood-iron': 1,
      'echo-glass-shard': rollInt(rng, 4, 8),
    },
    credits: rollCredits(rng, 100, 200),
    summaryLabel: 'Rare tech cache',
  }),
  UNSTABLE_CACHE: (rng) => ({
    tierId: 'UNSTABLE_CACHE',
    resources: {
      'veil-ash-canister': 1,
      ...(rng() < 0.25 ? { 'ossified-ley-knot': 1 } : {}),
      'sanguine-ampoule': 1,
    },
    credits: rollCredits(rng, 100, 200),
    summaryLabel: 'Unstable cache',
  }),
  APEX_CACHE: (rng) => ({
    tierId: 'APEX_CACHE',
    resources: {
      'anomalous-core': 1,
      'encrypted-grid-drive': 1,
    },
    credits: rollCredits(rng, 150, 300),
    summaryLabel: 'Apex cache',
  }),
  DUD_CACHE: (rng) => ({
    tierId: 'DUD_CACHE',
    resources: {
      'ley-slag': rollInt(rng, 1, 3),
      'echo-glass-shard': rollInt(rng, 1, 3),
    },
    credits: rollCredits(rng, 0, 50),
    summaryLabel: 'Damaged cache',
    dudFlavor: 'Most contents degraded during extraction.',
  }),
};

function resolveTierWeights(valueBand?: AppraisalValueBand): Record<CasketRewardTierId, number> {
  const weights = { ...BASE_TIER_WEIGHTS };
  if (valueBand) {
    const mods = BAND_TIER_MODIFIERS[valueBand];
    (Object.entries(mods) as Array<[CasketRewardTierId, number]>).forEach(([tier, delta]) => {
      weights[tier] = Math.max(0, (weights[tier] ?? 0) + delta);
    });
  }
  return weights;
}

function pickTier(valueBand: AppraisalValueBand | undefined, rng: () => number): CasketRewardTierId {
  if (debugForcedTier) return debugForcedTier;
  const weights = resolveTierWeights(valueBand);
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let roll = rng() * total;
  for (const [tier, weight] of Object.entries(weights) as Array<[CasketRewardTierId, number]>) {
    roll -= weight;
    if (roll <= 0) return tier;
  }
  return 'COMMON_CACHE';
}

export function rollSealedCasketOpenReward({
  valueBand,
  rng = Math.random,
}: {
  valueBand?: AppraisalValueBand;
  rng?: () => number;
} = {}): SealedCasketOpenReward {
  const tier = pickTier(valueBand, rng);
  return TIER_ROLLERS[tier](rng);
}

export function validateSealedCasketRewardTable(): string[] {
  const issues: string[] = [];
  SEALED_CASKET_REWARD_RESOURCE_IDS.forEach((resourceId) => {
    if (!RESOURCE_REGISTRY[resourceId]) {
      issues.push(`Casket reward references missing resource: ${resourceId}`);
    }
  });
  (Object.keys(TIER_ROLLERS) as CasketRewardTierId[]).forEach((tierId) => {
    const reward = TIER_ROLLERS[tierId](() => 0.5);
    Object.keys(reward.resources).forEach((resourceId) => {
      if (!RESOURCE_REGISTRY[resourceId as ResourceItemId]) {
        issues.push(`Tier ${tierId} references missing resource: ${resourceId}`);
      }
    });
  });
  return issues;
}

export function simulateSealedCasketOpenRolls(
  count: number,
  valueBand?: AppraisalValueBand,
): SealedCasketOpenReward[] {
  return Array.from({ length: count }, () => rollSealedCasketOpenReward({ valueBand }));
}
