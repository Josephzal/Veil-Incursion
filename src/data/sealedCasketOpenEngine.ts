import type { ResourceItemId, ResourceQuantity } from '../types/resourceItem';

export const SEALED_CASKET_REWARD_RESOURCE_IDS: readonly ResourceItemId[] = [
  'ley-slag',
  'echo-glass-shard',
  'encrypted-grid-drive',
];

export interface SealedCasketOpenReward {
  resources: ResourceQuantity;
  credits: number;
  summaryLabel: string;
}

const CASKET_REWARD_TABLE: Array<{
  weight: number;
  roll: (rng: () => number) => SealedCasketOpenReward;
}> = [
  {
    weight: 50,
    roll: (rng) => ({
      resources: { 'ley-slag': 2 + Math.floor(rng() * 3) },
      credits: 25,
      summaryLabel: 'Salvage cache',
    }),
  },
  {
    weight: 30,
    roll: () => ({
      resources: { 'echo-glass-shard': 1 },
      credits: 40,
      summaryLabel: 'Echo imprint residue',
    }),
  },
  {
    weight: 20,
    roll: () => ({
      resources: { 'encrypted-grid-drive': 1 },
      credits: 75,
      summaryLabel: 'Contraband windfall',
    }),
  },
];

export function rollSealedCasketOpenReward(rng: () => number = Math.random): SealedCasketOpenReward {
  const total = CASKET_REWARD_TABLE.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = rng() * total;
  for (const entry of CASKET_REWARD_TABLE) {
    roll -= entry.weight;
    if (roll <= 0) return entry.roll(rng);
  }
  return CASKET_REWARD_TABLE[0]!.roll(rng);
}
