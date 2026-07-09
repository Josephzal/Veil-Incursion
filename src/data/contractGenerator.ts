import type { GeneratedContract } from '../types/contract';
import type { ContractTemplateSpec } from './contractTemplates';
import type { ResourceItemId } from '../types/resourceItem';
import type { CabalEmployerId, SectorId } from '../types/worldState';
import {
  buildContractTitle,
  CONTRACT_TEMPLATE_SPECS,
  RECOMMENDED_SECTORS_BY_RESOURCE,
  SPONSOR_CONTRACT_QUOTAS,
  type ContractTemplateContext,
} from './contractTemplates';
import {
  canResourceSpawnInSector,
  CONTRACT_TARGET_RESOURCE_IDS,
  getResourceCategory,
  getResourceDefinition,
  RESOURCE_REGISTRY,
} from './resourceRegistry';

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function validSectorsForResource(resourceId: ResourceItemId): SectorId[] {
  return [...RESOURCE_REGISTRY[resourceId].validSectorIds];
}

function validSectorsForResources(resourceIds: ResourceItemId[]): SectorId[] {
  if (resourceIds.length === 0) return [];
  const sets = resourceIds.map((id) => new Set(validSectorsForResource(id)));
  const intersection = [...sets[0]!].filter((sectorId) =>
    sets.every((set) => set.has(sectorId)),
  );
  if (intersection.length > 0) return intersection;
  const union = new Set<SectorId>();
  sets.forEach((set) => set.forEach((id) => union.add(id)));
  return [...union];
}

function recommendedSectorsForContract(
  resourceId: ResourceItemId | undefined,
  resourceOptions: ResourceItemId[] | undefined,
  validSectorIds: SectorId[],
): SectorId[] {
  const ids = resourceOptions?.length
    ? resourceOptions
    : resourceId
      ? [resourceId]
      : [];
  const fromMap = ids.flatMap((id) => RECOMMENDED_SECTORS_BY_RESOURCE[id] ?? []);
  const unique = [...new Set(fromMap.filter((s) => validSectorIds.includes(s)))];
  if (unique.length > 0) return unique;
  return validSectorIds.slice(0, Math.min(2, validSectorIds.length));
}

function validateGeneratedContract(contract: GeneratedContract): boolean {
  if (contract.objectiveKind === 'COMPLETE_EMERGENCY_RECALL') return true;
  if (contract.objectiveKind === 'DEFEAT_ELITE') return true;
  if (contract.objectiveKind === 'DEFEAT_DEPTH_BOSS') return true;
  if (contract.objectiveKind === 'REACH_DEPTH_AND_EXTRACT') return true;
  if (contract.objectiveKind === 'CLEAR_OPERATION_TARGET') return true;

  const resourceIds = contract.targetResourceOptions?.length
    ? contract.targetResourceOptions
    : contract.targetResourceId
      ? [contract.targetResourceId]
      : [];

  if (resourceIds.length === 0) return false;

  return resourceIds.every((id) => {
    const def = RESOURCE_REGISTRY[id];
    if (!def.canBeContractTarget) return false;
    if (def.validSectorIds.length === 0) return false;
    return contract.validSectorIds.some((sectorId) => canResourceSpawnInSector(id, sectorId));
  });
}

function instantiateTemplate(
  spec: ContractTemplateSpec,
  sponsorId: CabalEmployerId,
  runIndex: number,
  slot: number,
): GeneratedContract | null {
  const seed = `contract:${runIndex}:${sponsorId}:${spec.kind}:${slot}`;
  const rng = mulberry32(hashSeed(seed));
  const ctx: ContractTemplateContext = { sponsorId, seed, rng };

  const resourcePick = spec.pickResources?.(ctx);
  const targetResourceId = resourcePick?.targetResourceId;
  const targetResourceOptions = resourcePick?.targetResourceOptions;
  const targetQuantity = resourcePick?.targetQuantity ?? 1;

  const resourceIds = targetResourceOptions?.length
    ? targetResourceOptions
    : targetResourceId
      ? [targetResourceId]
      : [];

  const validSectorIds = resourceIds.length > 0
    ? validSectorsForResources(resourceIds)
    : (['THE_SLAG_WORKS', 'THE_NULL_ZONE', 'THE_BLACKLINE_TERMINUS', 'THE_ASHEN_WASTES', 'THE_ABYSSAL_SINK'] as SectorId[]);

  if (resourceIds.length > 0 && validSectorIds.length === 0) return null;

  const recommendedSectorIds = recommendedSectorsForContract(
    targetResourceId,
    targetResourceOptions,
    validSectorIds,
  );

  const difficulty = Math.min(5, Math.max(1, spec.difficultyBase + (rng() < 0.3 ? 1 : 0))) as GeneratedContract['difficulty'];
  const eliteKills = spec.kind === 'DEFEAT_ELITE'
    ? 1 + Math.floor(rng() * 2)
    : (spec.requiredEliteKills ?? 1);

  const objectiveText = spec.kind === 'DEFEAT_ELITE'
    ? `Defeat ${eliteKills} elite encounter${eliteKills > 1 ? 's' : ''} before extracting.`
    : spec.kind === 'REACH_DEPTH_AND_EXTRACT'
      ? `Reach Depth ${spec.requiredDepth ?? 2} and extract alive.`
      : spec.buildObjectiveText(ctx);

  const contract: GeneratedContract = {
    id: `${sponsorId.toLowerCase()}-${spec.kind.toLowerCase()}-${runIndex}-${slot}`,
    sponsorId,
    title: buildContractTitle(spec, ctx),
    objectiveKind: spec.kind,
    objectiveText,
    targetResourceId,
    targetResourceOptions,
    targetQuantity,
    targetCategory: targetResourceId ? getResourceCategory(targetResourceId) : undefined,
    validSectorIds,
    recommendedSectorIds,
    requiredDepth: spec.requiredDepth,
    requiresEmergencyRecall: spec.requiresEmergencyRecall,
    requiredEliteKills: eliteKills,
    requiredOperationTargets: spec.requiredOperationTargets,
    bonusObjective: spec.kind === 'RECOVER_INTEL'
      ? { text: 'Extract before Depth 3.', kind: 'EARLY_EXTRACTION' }
      : spec.kind === 'COMPLETE_EMERGENCY_RECALL'
        ? { text: 'Defeat a depth boss before Emergency Recall.', kind: 'ELITE_KILL' }
        : spec.kind === 'RECOVER_APEX_CARGO'
          ? { text: 'Extract from Depth 3.', kind: 'DEPTH_EXTRACT' }
          : undefined,
    reward: spec.rewardFor(sponsorId, difficulty),
    bonusReward: spec.kind === 'RECOVER_ECONOMY_INTEL'
      ? { credits: 40, reputation: 1 }
      : undefined,
    difficulty,
    refreshLabel: 'Refreshes after run',
  };

  return validateGeneratedContract(contract) ? contract : null;
}

function weightedPickTemplate(
  pool: ContractTemplateSpec[],
  rng: () => number,
): ContractTemplateSpec {
  const total = pool.reduce((sum, spec) => sum + spec.weight, 0);
  let roll = rng() * total;
  for (const spec of pool) {
    roll -= spec.weight;
    if (roll <= 0) return spec;
  }
  return pool[pool.length - 1]!;
}

export function generateContractBoard(runIndex: number): GeneratedContract[] {
  const rng = mulberry32(hashSeed(`board:${runIndex}`));
  const contracts: GeneratedContract[] = [];
  const usedKinds = new Set<string>();

  (Object.keys(SPONSOR_CONTRACT_QUOTAS) as CabalEmployerId[]).forEach((sponsorId) => {
    const quota = SPONSOR_CONTRACT_QUOTAS[sponsorId];
    const sponsorPool = CONTRACT_TEMPLATE_SPECS.filter((spec) => spec.sponsors.includes(sponsorId));
    let attempts = 0;

    while (
      contracts.filter((c) => c.sponsorId === sponsorId).length < quota
      && attempts < 24
    ) {
      attempts += 1;
      const spec = weightedPickTemplate(sponsorPool, rng);
      const kindKey = `${sponsorId}:${spec.kind}`;
      if (usedKinds.has(kindKey) && attempts < 12) continue;

      const slot = contracts.filter((c) => c.sponsorId === sponsorId).length;
      const generated = instantiateTemplate(spec, sponsorId, runIndex, slot);
      if (!generated) continue;

      usedKinds.add(kindKey);
      contracts.push(generated);
    }
  });

  if (contracts.length < 6) {
    const fallbackIds = CONTRACT_TARGET_RESOURCE_IDS.slice(0, 6 - contracts.length);
    fallbackIds.forEach((resourceId, index) => {
      const sponsorId: CabalEmployerId = index % 3 === 0
        ? 'TERRAN_GRID'
        : index % 3 === 1
          ? 'LEGION'
          : 'SOLARIS';
      if (contracts.filter((c) => c.sponsorId === sponsorId).length >= 2) return;
      const def = getResourceDefinition(resourceId);
      contracts.push({
        id: `fallback-${runIndex}-${resourceId}`,
        sponsorId,
        title: `${def.shortName} Recovery`,
        objectiveKind: 'EXTRACT_STABLE_RESOURCE',
        objectiveText: `Extract 1 ${def.name}.`,
        targetResourceId: resourceId,
        targetQuantity: 1,
        targetCategory: def.category,
        validSectorIds: def.validSectorIds,
        recommendedSectorIds: recommendedSectorsForContract(resourceId, undefined, [...def.validSectorIds]),
        reward: { credits: 100, reputation: 2 },
        difficulty: 2,
        refreshLabel: 'Refreshes after run',
      });
    });
  }

  return contracts.slice(0, 6);
}

export function seedExampleContracts(runIndex: number): GeneratedContract[] {
  return generateContractBoard(runIndex);
}

export function generateContractForObjectiveKind(
  kind: 'RECOVER_ECONOMY_INTEL' | 'RECOVER_CONTRABAND',
  runIndex: number,
  sponsorId?: CabalEmployerId,
): GeneratedContract | null {
  const spec = CONTRACT_TEMPLATE_SPECS.find((entry) => entry.kind === kind);
  if (!spec) return null;
  const sponsor = sponsorId && spec.sponsors.includes(sponsorId)
    ? sponsorId
    : spec.sponsors[0];
  return instantiateTemplate(spec, sponsor, runIndex, 777);
}
