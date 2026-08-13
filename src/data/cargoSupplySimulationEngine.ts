import { CARGO_GRID_CELL_COUNT } from '../types/cargoGrid';

export type CargoSupplyPolicy = 'SURVIVAL_FIRST' | 'RESOURCE_FIRST' | 'BALANCED';
export type CargoSupplyRunBand = 'EARLY' | 'MID' | 'DEEP';

export interface CargoSupplyBandSimulation {
  band: CargoSupplyRunBand;
  suppliesAcquired: number;
  suppliesUsed: number;
  encounters: number;
}

export interface CargoSupplyPolicySimulation {
  policy: CargoSupplyPolicy;
  seed: string;
  survived: boolean;
  softlocked: boolean;
  bands: CargoSupplyBandSimulation[];
  suppliesPacked: number;
  suppliesFound: number;
  suppliesUsed: number;
  suppliesExtracted: number;
  suppliesBanked: number;
  suppliesJettisoned: number;
  resourcesCarried: number;
  resourcesDisplacedForSupply: number;
  fullCargoDecisions: number;
  duplicateInstanceIds: number;
  reconciliationMismatch: number;
}

interface SimCell {
  instanceId: string;
  kind: 'SUPPLY' | 'RESOURCE';
}

function seededUnit(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0x1_0000_0000;
  };
}

const POLICY = {
  SURVIVAL_FIRST: { packed: 3, startingResources: 2, supplyTarget: 5, useAtHp: 72 },
  RESOURCE_FIRST: { packed: 1, startingResources: 5, supplyTarget: 1, useAtHp: 38 },
  BALANCED: { packed: 2, startingResources: 3, supplyTarget: 3, useAtHp: 56 },
} satisfies Record<CargoSupplyPolicy, {
  packed: number;
  startingResources: number;
  supplyTarget: number;
  useAtHp: number;
}>;

const BANDS: readonly CargoSupplyRunBand[] = ['EARLY', 'MID', 'DEEP'];

export function simulateCargoSupplyPolicy(
  policy: CargoSupplyPolicy,
  seed = 'stage-iv-b',
): CargoSupplyPolicySimulation {
  const config = POLICY[policy];
  const random = seededUnit(seed);
  const cargo: SimCell[] = [];
  let serial = 0;
  const add = (kind: SimCell['kind']) => {
    cargo.push({ instanceId: `${policy}:${kind}:${serial++}`, kind });
  };
  for (let index = 0; index < config.packed; index += 1) add('SUPPLY');
  for (let index = 0; index < config.startingResources; index += 1) add('RESOURCE');

  let hp = 100;
  let found = 0;
  let used = 0;
  let displaced = 0;
  let fullCargoDecisions = 0;
  const bands: CargoSupplyBandSimulation[] = [];

  BANDS.forEach((band) => {
    const beforeFound = found;
    const beforeUsed = used;
    for (let encounter = 0; encounter < 6; encounter += 1) {
      hp -= 11 + Math.floor(random() * 8);

      const supplyOffer = encounter === 1 || encounter === 4;
      if (supplyOffer) {
        const supplyCount = cargo.filter((cell) => cell.kind === 'SUPPLY').length;
        const shouldTake = supplyCount < config.supplyTarget;
        if (cargo.length >= CARGO_GRID_CELL_COUNT) {
          fullCargoDecisions += 1;
          if (shouldTake) {
            const resourceIndex = cargo.findIndex((cell) => cell.kind === 'RESOURCE');
            if (resourceIndex >= 0) {
              cargo.splice(resourceIndex, 1);
              displaced += 1;
              add('SUPPLY');
              found += 1;
            }
          }
        } else if (shouldTake) {
          add('SUPPLY');
          found += 1;
        }
      } else if (cargo.length < CARGO_GRID_CELL_COUNT) {
        add('RESOURCE');
      }

      if (hp <= config.useAtHp) {
        const supplyIndex = cargo.findIndex((cell) => cell.kind === 'SUPPLY');
        if (supplyIndex >= 0) {
          cargo.splice(supplyIndex, 1);
          used += 1;
          hp = Math.min(100, hp + 34);
        }
      }
    }
    bands.push({
      band,
      suppliesAcquired: found - beforeFound,
      suppliesUsed: used - beforeUsed,
      encounters: 6,
    });
  });

  const ids = cargo.map((cell) => cell.instanceId);
  const duplicateInstanceIds = ids.length - new Set(ids).size;
  const carriedSupplies = cargo.filter((cell) => cell.kind === 'SUPPLY').length;
  const resourcesCarried = cargo.filter((cell) => cell.kind === 'RESOURCE').length;
  const suppliesBanked = policy === 'BALANCED' ? Math.min(1, carriedSupplies) : 0;
  const suppliesExtracted = carriedSupplies - suppliesBanked;
  const expectedSupplyTotal = config.packed + found;
  const reconciledSupplyTotal = used + suppliesBanked + suppliesExtracted;

  return {
    policy,
    seed,
    survived: hp > 0,
    softlocked: false,
    bands,
    suppliesPacked: config.packed,
    suppliesFound: found,
    suppliesUsed: used,
    suppliesExtracted,
    suppliesBanked,
    suppliesJettisoned: 0,
    resourcesCarried,
    resourcesDisplacedForSupply: displaced,
    fullCargoDecisions,
    duplicateInstanceIds,
    reconciliationMismatch: expectedSupplyTotal - reconciledSupplyTotal,
  };
}

export function simulateCargoSupplyPolicies(
  seed = 'stage-iv-b',
): CargoSupplyPolicySimulation[] {
  return (Object.keys(POLICY) as CargoSupplyPolicy[]).map(
    (policy) => simulateCargoSupplyPolicy(policy, seed),
  );
}

export function formatCargoSupplySimulationReport(seed = 'stage-iv-b'): string {
  return simulateCargoSupplyPolicies(seed).map((result) => (
    `${result.policy}: survived=${result.survived} supplies ${result.suppliesUsed} used/`
    + `${result.suppliesExtracted + result.suppliesBanked} retained, resources=${result.resourcesCarried}, `
    + `full decisions=${result.fullCargoDecisions}, displaced=${result.resourcesDisplacedForSupply}`
  )).join('\n');
}
