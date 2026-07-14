import type { AppraisalValueBand } from '../types/sealedCargo';
import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';
import { RESOURCE_REGISTRY } from './resourceRegistry';

export type SpecimenJarRewardTierId =
  | 'SPECIMEN_COMMON'
  | 'SPECIMEN_BIOLOGIC'
  | 'SPECIMEN_UNSTABLE'
  | 'SPECIMEN_SEAL'
  | 'SPECIMEN_BREACH'
  | 'SPECIMEN_DUD';

export interface SpecimenJarOpenReward {
  tierId: SpecimenJarRewardTierId;
  resources: ResourceQuantity;
  credits: number;
  summaryLabel: string;
  dudFlavor?: string;
}

/** Suggested Phase D contents — lower-tier sibling to the Sealed Containment Casket. */
export const SPECIMEN_JAR_REWARD_RESOURCE_IDS: readonly ResourceItemId[] = [
  'mycelial-ichor',
  'sanguine-ampoule',
  'veil-ash-canister',
  'ossified-ley-knot',
  'containment-seal',
  'breach-thread',
  'ley-slag',
  'echo-glass-shard',
];

const BASE_TIER_WEIGHTS: Record<SpecimenJarRewardTierId, number> = {
  SPECIMEN_COMMON: 32,
  SPECIMEN_BIOLOGIC: 24,
  SPECIMEN_UNSTABLE: 18,
  SPECIMEN_SEAL: 12,
  SPECIMEN_BREACH: 6,
  SPECIMEN_DUD: 8,
};

const BAND_TIER_MODIFIERS: Record<AppraisalValueBand, Partial<Record<SpecimenJarRewardTierId, number>>> = {
  LOW_VALUE: {
    SPECIMEN_COMMON: 12,
    SPECIMEN_DUD: 10,
    SPECIMEN_BREACH: -4,
    SPECIMEN_SEAL: -4,
  },
  STANDARD_VALUE: {},
  HIGH_VALUE: {
    SPECIMEN_DUD: -3,
    SPECIMEN_COMMON: -6,
    SPECIMEN_UNSTABLE: 5,
    SPECIMEN_SEAL: 4,
  },
  RARE_VALUE: {
    SPECIMEN_DUD: -4,
    SPECIMEN_COMMON: -8,
    SPECIMEN_SEAL: 6,
    SPECIMEN_BREACH: 5,
    SPECIMEN_UNSTABLE: 4,
  },
  APEX_VALUE: {
    SPECIMEN_DUD: -5,
    SPECIMEN_COMMON: -10,
    SPECIMEN_BREACH: 10,
    SPECIMEN_SEAL: 6,
    SPECIMEN_UNSTABLE: 4,
  },
};

let debugForcedTier: SpecimenJarRewardTierId | null = null;

export function setDebugForcedSpecimenJarTier(tier: SpecimenJarRewardTierId | null): void {
  debugForcedTier = tier;
}

function rollInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

const TIER_ROLLERS: Record<SpecimenJarRewardTierId, (rng: () => number) => SpecimenJarOpenReward> = {
  SPECIMEN_COMMON: (rng) => ({
    tierId: 'SPECIMEN_COMMON',
    resources: {
      'mycelial-ichor': rollInt(rng, 1, 2),
      'sanguine-ampoule': 1,
    },
    credits: rollInt(rng, 25, 60),
    summaryLabel: 'Preserved common specimen',
  }),
  SPECIMEN_BIOLOGIC: (rng) => ({
    tierId: 'SPECIMEN_BIOLOGIC',
    resources: {
      'sanguine-ampoule': rollInt(rng, 1, 2),
      'mycelial-ichor': 1,
      ...(rng() < 0.35 ? { 'ossified-ley-knot': 1 } : {}),
    },
    credits: rollInt(rng, 40, 90),
    summaryLabel: 'Biologic specimen jar',
  }),
  SPECIMEN_UNSTABLE: (rng) => ({
    tierId: 'SPECIMEN_UNSTABLE',
    resources: {
      'veil-ash-canister': 1,
      ...(rng() < 0.4 ? { 'ossified-ley-knot': 1 } : { 'sanguine-ampoule': 1 }),
    },
    credits: rollInt(rng, 50, 110),
    summaryLabel: 'Unstable specimen payload',
  }),
  SPECIMEN_SEAL: (rng) => ({
    tierId: 'SPECIMEN_SEAL',
    resources: {
      'containment-seal': 1,
      'mycelial-ichor': 1,
    },
    credits: rollInt(rng, 60, 120),
    summaryLabel: 'Containment-bound specimen',
  }),
  SPECIMEN_BREACH: (rng) => ({
    tierId: 'SPECIMEN_BREACH',
    resources: {
      'breach-thread': 1,
      ...(rng() < 0.5 ? { 'containment-seal': 1 } : { 'ossified-ley-knot': 1 }),
    },
    credits: rollInt(rng, 80, 160),
    summaryLabel: 'Breach-threaded specimen',
  }),
  SPECIMEN_DUD: (rng) => ({
    tierId: 'SPECIMEN_DUD',
    resources: {
      'ley-slag': rollInt(rng, 1, 3),
      'echo-glass-shard': rollInt(rng, 1, 2),
    },
    credits: rollInt(rng, 0, 30),
    summaryLabel: 'Spoiled specimen',
    dudFlavor: 'The label lied — contents spoiled in transit.',
  }),
};

function resolveTierWeights(valueBand?: AppraisalValueBand): Record<SpecimenJarRewardTierId, number> {
  const weights = { ...BASE_TIER_WEIGHTS };
  if (valueBand) {
    const mods = BAND_TIER_MODIFIERS[valueBand];
    (Object.entries(mods) as Array<[SpecimenJarRewardTierId, number]>).forEach(([tier, delta]) => {
      weights[tier] = Math.max(0, (weights[tier] ?? 0) + delta);
    });
  }
  return weights;
}

function pickTier(valueBand: AppraisalValueBand | undefined, rng: () => number): SpecimenJarRewardTierId {
  if (debugForcedTier) return debugForcedTier;
  const weights = resolveTierWeights(valueBand);
  const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
  let roll = rng() * total;
  for (const [tier, weight] of Object.entries(weights) as Array<[SpecimenJarRewardTierId, number]>) {
    roll -= weight;
    if (roll <= 0) return tier;
  }
  return 'SPECIMEN_COMMON';
}

export function rollSpecimenJarOpenReward({
  valueBand,
  rng = Math.random,
}: {
  valueBand?: AppraisalValueBand;
  rng?: () => number;
} = {}): SpecimenJarOpenReward {
  const tier = pickTier(valueBand, rng);
  return TIER_ROLLERS[tier](rng);
}

export function validateSpecimenJarRewardTable(): string[] {
  const issues: string[] = [];
  SPECIMEN_JAR_REWARD_RESOURCE_IDS.forEach((resourceId) => {
    if (!RESOURCE_REGISTRY[resourceId]) {
      issues.push(`Specimen jar reward references missing resource: ${resourceId}`);
    }
  });
  (Object.keys(TIER_ROLLERS) as SpecimenJarRewardTierId[]).forEach((tierId) => {
    const reward = TIER_ROLLERS[tierId](() => 0.5);
    Object.keys(reward.resources).forEach((resourceId) => {
      if (!RESOURCE_REGISTRY[resourceId as ResourceItemId]) {
        issues.push(`Specimen tier ${tierId} references missing resource: ${resourceId}`);
      }
    });
  });
  return issues;
}

export function simulateSpecimenJarOpenRolls(
  count: number,
  valueBand?: AppraisalValueBand,
): SpecimenJarOpenReward[] {
  return Array.from({ length: count }, () => rollSpecimenJarOpenReward({ valueBand }));
}
