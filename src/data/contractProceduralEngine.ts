import type {
  ContractBonusObjective,
  ContractObjectiveKind,
  ContractRewardPackage,
  GeneratedContract,
} from '../types/contract';
import type {
  ContractBoundContext,
  ContractGenerationContext,
  ContractProceduralMemory,
  ContractSourceKind,
} from '../types/contractProcedural';
import {
  CONTRACT_BOARD_REROLL_ATTEMPTS,
  CONTRACT_PROCEDURAL_MEMORY_DEPTH,
} from '../types/contractProcedural';
import type { RunDepth } from '../types/narrativeProcedural';
import type { ResourceItemId } from '../types/resourceItem';
import { minBreachGradeForContractDifficulty } from './breachGradeEngine';
import type {
  CabalEmployerId,
  EchoActivityLevel,
  OperationObjectiveKind,
  OperationState,
  SectorId,
  VeilAnchorState,
  WorldStatePersistedState,
} from '../types/worldState';
import {
  CONTRACT_EMERGENCY_RECALL_RARE_LOOT_PCT,
  buildContractRewardPackage,
  contractCreditsForKind,
} from './balance/contractBalanceConfig';
import {
  CONTRACT_TEMPLATE_SPECS,
  RECOMMENDED_SECTORS_BY_RESOURCE,
  SPONSOR_CONTRACT_QUOTAS,
  type ContractTemplateSpec,
} from './contractTemplates';
import {
  CONTRACT_TEXT_VARIANTS,
  SPONSOR_TITLE_PREFIXES,
  fillContractTemplate,
  hashContractTitle,
  hasUnresolvedPlaceholders,
  type ContractPlaceholderContext,
} from './contractTemplateVariants';
import {
  SECTOR_RESOURCE_IDS,
  SPONSOR_CONTRACT_PREFERENCES,
  SPONSOR_RESOURCE_BY_CABAL,
  sponsorDisplayLabel,
} from './contractSponsorPreferences';
import { resourceIdFromFocusLabel } from './operationProceduralEngine';
import { getSectorWorldTemplate } from './sectorWorldCatalog';
import {
  canResourceSpawnInSector,
  getResourceCategory,
  getResourceDefinition,
  RESOURCE_REGISTRY,
} from './resourceRegistry';

export interface GenerateContractBoardOptions {
  deployRunIndex: number;
  sectorId: SectorId;
  activeOperation?: OperationState | null;
  activeAnchor?: VeilAnchorState | null;
  sectorResourceFocus?: string[];
  hazardLevel?: number;
  rewardLevel?: number;
  echoActivity?: EchoActivityLevel;
  recentContractMemory?: ContractProceduralMemory;
  crisisTheme?: import('../types/runWorldBrief').CrisisTheme | null;
  resourceStress?: import('../types/runWorldBrief').ResourceStress | null;
  threatProfile?: import('../types/runWorldBrief').ThreatProfile | null;
  contractBias?: import('../types/runWorldBrief').RunWorldBriefContractBias | null;
  sponsorInterest?: import('../types/runWorldBrief').SponsorInterestProfile[] | null;
}

function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}

function pickOne<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)]!;
}

export function createEmptyContractMemory(): ContractProceduralMemory {
  return {
    recentContractKindsBySponsor: {},
    recentContractTitleHashesBySponsor: {},
    recentContractResourceIdsBySponsor: {},
    recentBoardMemoryKeys: [],
  };
}

export function getContractMemory(
  persisted?: Pick<WorldStatePersistedState, 'contractProceduralMemory'>,
): ContractProceduralMemory {
  const existing = persisted?.contractProceduralMemory;
  if (!existing) return createEmptyContractMemory();
  return {
    recentContractKindsBySponsor: { ...existing.recentContractKindsBySponsor },
    recentContractTitleHashesBySponsor: { ...existing.recentContractTitleHashesBySponsor },
    recentContractResourceIdsBySponsor: { ...existing.recentContractResourceIdsBySponsor },
    recentBoardMemoryKeys: [...existing.recentBoardMemoryKeys],
  };
}

export function recordContractsInMemory(
  memory: ContractProceduralMemory,
  contracts: GeneratedContract[],
): ContractProceduralMemory {
  const next = { ...memory };
  contracts.forEach((contract) => {
    const sponsor = contract.sponsorId;
    const kinds = [...(next.recentContractKindsBySponsor[sponsor] ?? []), contract.objectiveKind]
      .slice(0, CONTRACT_PROCEDURAL_MEMORY_DEPTH);
    next.recentContractKindsBySponsor = {
      ...next.recentContractKindsBySponsor,
      [sponsor]: kinds,
    };
    if (contract.titleHash) {
      const hashes = [...(next.recentContractTitleHashesBySponsor[sponsor] ?? []), contract.titleHash]
        .slice(0, CONTRACT_PROCEDURAL_MEMORY_DEPTH);
      next.recentContractTitleHashesBySponsor = {
        ...next.recentContractTitleHashesBySponsor,
        [sponsor]: hashes,
      };
    }
    const resId = contract.targetResourceId ?? contract.targetResourceOptions?.[0];
    if (resId) {
      const resources = [...(next.recentContractResourceIdsBySponsor[sponsor] ?? []), resId]
        .slice(0, CONTRACT_PROCEDURAL_MEMORY_DEPTH);
      next.recentContractResourceIdsBySponsor = {
        ...next.recentContractResourceIdsBySponsor,
        [sponsor]: resources,
      };
    }
    if (contract.recentMemoryKey) {
      next.recentBoardMemoryKeys = [
        contract.recentMemoryKey,
        ...next.recentBoardMemoryKeys,
      ].slice(0, CONTRACT_PROCEDURAL_MEMORY_DEPTH * 3);
    }
  });
  return next;
}

export function buildContractGenerationContext(
  opts: GenerateContractBoardOptions,
): ContractGenerationContext {
  const sector = getSectorWorldTemplate(opts.sectorId);
  const op = opts.activeOperation ?? null;
  const anchor = opts.activeAnchor ?? null;
  const seedParts = [
    String(opts.deployRunIndex),
    opts.sectorId,
    op?.id ?? 'no-op',
    anchor?.type ?? 'no-anchor',
  ];
  return {
    seed: seedParts.join(':'),
    deployRunIndex: opts.deployRunIndex,
    sectorId: opts.sectorId,
    sectorDisplayName: sector.displayName,
    sectorResourceFocus: opts.sectorResourceFocus ?? sector.resourceFocus,
    hazardLevel: opts.hazardLevel ?? sector.hazardLevel,
    rewardLevel: opts.rewardLevel ?? sector.rewardLevel,
    echoActivity: opts.echoActivity ?? sector.echoActivity,
    activeOperation: op,
    activeAnchor: anchor,
    recentContractMemory: opts.recentContractMemory ?? createEmptyContractMemory(),
    crisisTheme: opts.crisisTheme ?? null,
    resourceStress: opts.resourceStress ?? null,
    threatProfile: opts.threatProfile ?? null,
    contractBias: opts.contractBias ?? null,
    sponsorInterest: opts.sponsorInterest ?? null,
  };
}

const BASE_SOURCE_WEIGHTS: Record<ContractSourceKind, number> = {
  OPERATION_ALIGNED: 30,
  ANCHOR_ALIGNED: 20,
  SECTOR_RESOURCE: 20,
  SPONSOR_PREFERENCE: 20,
  DEPTH_PRESSURE: 5,
  WILDCARD: 5,
};

const OPERATION_KIND_OBJECTIVE_BIAS: Record<OperationObjectiveKind, Partial<Record<ContractObjectiveKind, number>>> = {
  RESOURCE_SURVEY: { EXTRACT_STABLE_RESOURCE: 3, EXTRACT_SPONSOR_RESOURCE: 2, CLEAR_OPERATION_TARGET: 1 },
  ANCHOR_ASSAULT: { CLEAR_OPERATION_TARGET: 4, DEFEAT_ELITE: 3, EXTRACT_UNSTABLE_CARGO: 1 },
  ECHO_RECOVERY: { EXTRACT_UNSTABLE_CARGO: 3, CLEAR_OPERATION_TARGET: 2, EXTRACT_SPONSOR_RESOURCE: 2 },
  EXTRACTION_SURGE: { COMPLETE_EMERGENCY_RECALL: 3, REACH_DEPTH_AND_EXTRACT: 2, EXTRACT_STABLE_RESOURCE: 2 },
  BOSS_SUPPRESSION: { DEFEAT_ELITE: 4, DEFEAT_DEPTH_BOSS: 3, REACH_DEPTH_AND_EXTRACT: 1 },
};

const SOURCE_SLOT_PREFERENCES: Record<number, ContractSourceKind[]> = {
  0: ['OPERATION_ALIGNED', 'ANCHOR_ALIGNED', 'SECTOR_RESOURCE'],
  1: ['SPONSOR_PREFERENCE', 'WILDCARD', 'DEPTH_PRESSURE'],
};

export function resolveContractSourceWeights(
  ctx: ContractGenerationContext,
): Record<ContractSourceKind, number> {
  const weights = { ...BASE_SOURCE_WEIGHTS };
  if (!ctx.activeOperation) weights.OPERATION_ALIGNED = 0;
  if (!ctx.activeAnchor) weights.ANCHOR_ALIGNED = 0;
  if (ctx.echoActivity === 'CRITICAL') {
    weights.WILDCARD += 3;
    weights.DEPTH_PRESSURE += 2;
  } else if (ctx.echoActivity === 'ELEVATED') {
    weights.WILDCARD += 1;
  }
  if (ctx.hazardLevel >= 4) {
    weights.DEPTH_PRESSURE += 3;
    weights.WILDCARD += 2;
  }
  if (ctx.rewardLevel >= 3) weights.SECTOR_RESOURCE += 3;
  const opKind = ctx.activeOperation?.objectiveKind;
  if (opKind === 'RESOURCE_SURVEY') weights.SECTOR_RESOURCE += 8;
  if (opKind === 'ANCHOR_ASSAULT') weights.ANCHOR_ALIGNED += 8;
  if (opKind === 'ECHO_RECOVERY') weights.OPERATION_ALIGNED += 5;
  if (opKind === 'EXTRACTION_SURGE') weights.WILDCARD += 3;
  if (opKind === 'BOSS_SUPPRESSION') weights.DEPTH_PRESSURE += 4;
  if (ctx.crisisTheme === 'ECHO_OUTBREAK') {
    weights.OPERATION_ALIGNED += 6;
    weights.ANCHOR_ALIGNED += 4;
  }
  if (ctx.crisisTheme === 'RESOURCE_BLOOM') weights.SECTOR_RESOURCE += 8;
  if (ctx.crisisTheme === 'FALSE_EXTRACTION_WAVE') weights.WILDCARD += 6;
  if (ctx.crisisTheme === 'CONTAINMENT_FAILURE') weights.SPONSOR_PREFERENCE += 6;
  if (ctx.contractBias?.sourceWeights) {
    Object.entries(ctx.contractBias.sourceWeights).forEach(([kind, boost]) => {
      const key = kind as ContractSourceKind;
      weights[key] = (weights[key] ?? 0) + (boost ?? 0);
    });
  }
  return weights;
}

function weightedPickSource(
  weights: Record<ContractSourceKind, number>,
  preferred: ContractSourceKind[],
  rand: () => number,
): ContractSourceKind {
  const boosted = { ...weights };
  preferred.forEach((kind, idx) => {
    boosted[kind] = (boosted[kind] ?? 0) + (preferred.length - idx) * 8;
  });
  const entries = Object.entries(boosted).filter(([, w]) => w > 0) as [ContractSourceKind, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  if (total <= 0) return 'SECTOR_RESOURCE';
  let roll = rand() * total;
  for (const [kind, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return kind;
  }
  return entries[entries.length - 1]![0];
}

function sectorResourceIds(sectorId: SectorId, ctx: ContractGenerationContext): ResourceItemId[] {
  const fromCatalog = SECTOR_RESOURCE_IDS[sectorId] ?? [];
  const fromFocus = ctx.sectorResourceFocus
    .map((label) => resourceIdFromFocusLabel(label, sectorId))
    .filter((id): id is ResourceItemId => id != null);
  const fromOp = ctx.activeOperation?.targetResourceIds ?? [];
  return [...new Set([...fromOp, ...fromFocus, ...fromCatalog])];
}

function pickResourceForContext(
  ctx: ContractGenerationContext,
  sponsorId: CabalEmployerId,
  source: ContractSourceKind,
  rand: () => number,
  exclude: ResourceItemId[],
): ResourceItemId | null {
  let pool: ResourceItemId[] = [];
  if (source === 'OPERATION_ALIGNED' && ctx.activeOperation?.targetResourceIds?.length) {
    pool = [...ctx.activeOperation.targetResourceIds];
  } else if (source === 'ANCHOR_ALIGNED') {
    pool = ['anchor-marrow', 'resonant-filament', 'breach-thread', 'containment-seal'];
  } else if (source === 'SECTOR_RESOURCE') {
    pool = sectorResourceIds(ctx.sectorId, ctx);
  } else if (source === 'SPONSOR_PREFERENCE') {
    pool = [...SPONSOR_RESOURCE_BY_CABAL[sponsorId]];
  } else {
    pool = [...SPONSOR_CONTRACT_PREFERENCES[sponsorId].preferredResources];
  }
  const sponsorProfile = ctx.sponsorInterest?.find((p) => p.sponsorId === sponsorId);
  if (sponsorProfile?.preferredResourceIds.length) {
    pool = [...sponsorProfile.preferredResourceIds, ...pool];
  }
  if (ctx.resourceStress?.highDemandResourceIds.length) {
    pool = [...ctx.resourceStress.highDemandResourceIds, ...pool];
  }
  const valid = pool.filter(
    (id) => canResourceSpawnInSector(id, ctx.sectorId) && !exclude.includes(id),
  );
  if (valid.length === 0) {
    const fallback = sectorResourceIds(ctx.sectorId, ctx).filter(
      (id) => canResourceSpawnInSector(id, ctx.sectorId) && !exclude.includes(id),
    );
    return fallback.length > 0 ? pickOne(fallback, rand) : null;
  }
  return pickOne(valid, rand);
}

function pickObjectiveKindForSource(
  source: ContractSourceKind,
  sponsorId: CabalEmployerId,
  ctx: ContractGenerationContext,
  rand: () => number,
): ContractObjectiveKind {
  const opKind = ctx.activeOperation?.objectiveKind;
  const opBias = opKind ? OPERATION_KIND_OBJECTIVE_BIAS[opKind] : undefined;
  const sponsorPrefs = SPONSOR_CONTRACT_PREFERENCES[sponsorId].objectiveKindWeights;
  const sponsorProfile = ctx.sponsorInterest?.find((p) => p.sponsorId === sponsorId);
  const sourceKinds: Record<ContractSourceKind, ContractObjectiveKind[]> = {
    OPERATION_ALIGNED: opKind === 'ANCHOR_ASSAULT' ? ['CLEAR_OPERATION_TARGET', 'DEFEAT_ELITE']
      : opKind === 'ECHO_RECOVERY' ? ['EXTRACT_UNSTABLE_CARGO', 'CLEAR_OPERATION_TARGET', 'EXTRACT_SPONSOR_RESOURCE']
        : opKind === 'EXTRACTION_SURGE' ? ['COMPLETE_EMERGENCY_RECALL', 'REACH_DEPTH_AND_EXTRACT', 'EXTRACT_STABLE_RESOURCE']
          : opKind === 'RESOURCE_SURVEY' ? ['EXTRACT_STABLE_RESOURCE', 'EXTRACT_SPONSOR_RESOURCE']
            : opKind === 'BOSS_SUPPRESSION' ? ['DEFEAT_ELITE', 'DEFEAT_DEPTH_BOSS']
              : ['CLEAR_OPERATION_TARGET', 'EXTRACT_SPONSOR_RESOURCE'],
    ANCHOR_ALIGNED: ['CLEAR_OPERATION_TARGET', 'DEFEAT_ELITE', 'EXTRACT_UNSTABLE_CARGO', 'EXTRACT_SPONSOR_RESOURCE'],
    SECTOR_RESOURCE: ['EXTRACT_STABLE_RESOURCE', 'EXTRACT_SPONSOR_RESOURCE'],
    SPONSOR_PREFERENCE: Object.keys(sponsorPrefs) as ContractObjectiveKind[],
    DEPTH_PRESSURE: ['REACH_DEPTH_AND_EXTRACT', 'RECOVER_APEX_CARGO', 'EXTRACT_UNSTABLE_CARGO'],
    WILDCARD: ['RECOVER_CONTRABAND', 'EXTRACT_UNSTABLE_CARGO', 'DEFEAT_ELITE', 'COMPLETE_EMERGENCY_RECALL'],
  };
  let pool = sourceKinds[source].filter((kind) =>
    CONTRACT_TEMPLATE_SPECS.find((s) => s.kind === kind)?.sponsors.includes(sponsorId),
  );
  if (pool.length === 0) {
    pool = CONTRACT_TEMPLATE_SPECS.filter((s) => s.sponsors.includes(sponsorId)).map((s) => s.kind);
  }
  const weights = pool.map((kind) => {
    let w = 1 + (sponsorPrefs[kind] ?? 0) + (opBias?.[kind] ?? 0);
    if (sponsorProfile?.preferredObjectiveKinds.includes(kind)) w += 4;
    if (ctx.contractBias?.preferredObjectiveKinds.includes(kind)) w += 3;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rand() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i]!;
    if (roll <= 0) return pool[i]!;
  }
  return pool[0]!;
}

function validSectorsForResource(resourceId: ResourceItemId): SectorId[] {
  return [...RESOURCE_REGISTRY[resourceId].validSectorIds];
}

function validSectorsForResources(resourceIds: ResourceItemId[]): SectorId[] {
  if (resourceIds.length === 0) return [];
  const sets = resourceIds.map((id) => new Set(validSectorsForResource(id)));
  const intersection = [...sets[0]!].filter((sectorId) => sets.every((set) => set.has(sectorId)));
  if (intersection.length > 0) return intersection;
  const union = new Set<SectorId>();
  sets.forEach((set) => set.forEach((id) => union.add(id)));
  return [...union];
}

function recommendedSectorsForContract(
  resourceId: ResourceItemId | undefined,
  resourceOptions: ResourceItemId[] | undefined,
  validSectorIds: SectorId[],
  ctx: ContractGenerationContext,
): SectorId[] {
  const ids = resourceOptions?.length ? resourceOptions : resourceId ? [resourceId] : [];
  const fromMap = ids.flatMap((id) => RECOMMENDED_SECTORS_BY_RESOURCE[id] ?? []);
  const unique = [...new Set(fromMap.filter((s) => validSectorIds.includes(s)))];
  if (unique.includes(ctx.sectorId)) return [ctx.sectorId, ...unique.filter((s) => s !== ctx.sectorId)];
  if (unique.length > 0) return unique;
  if (validSectorIds.includes(ctx.sectorId)) return [ctx.sectorId];
  return validSectorIds.slice(0, Math.min(2, validSectorIds.length));
}

function buildPlaceholderContext(
  ctx: ContractGenerationContext,
  sponsorId: CabalEmployerId,
  resourceId: ResourceItemId | null,
  quantity: number,
  depth: RunDepth,
): ContractPlaceholderContext {
  const resourceName = resourceId ? getResourceDefinition(resourceId).shortName : 'target material';
  const secondary = sectorResourceIds(ctx.sectorId, ctx)[1];
  return {
    sector: ctx.sectorDisplayName.replace(/^The\s+/i, ''),
    sponsor: sponsorDisplayLabel(sponsorId),
    anchor: ctx.activeAnchor?.displayName ?? 'the active anchor',
    resource: resourceName,
    secondaryResource: secondary ? getResourceDefinition(secondary).shortName : resourceName,
    operation: ctx.activeOperation?.title ?? 'the active operation',
    operationKind: ctx.activeOperation?.objectiveKind ?? 'sector crisis',
    depth: String(depth),
    threat: ctx.hazardLevel >= 4 ? 'critical' : 'elevated',
    target: resourceName,
    quantity: String(quantity),
    reward: 'sponsor payout',
    signal: ctx.activeOperation?.operationTags?.[0] ?? 'scanner bloom',
    risk: depth >= 3 ? 'high' : depth >= 2 ? 'moderate' : 'standard',
    verb: 'Recover',
  };
}

function rollBonusObjective(kind: ContractObjectiveKind, depth: RunDepth, rand: () => number): ContractBonusObjective | undefined {
  if (rand() > 0.55) return undefined;
  if (kind === 'DEFEAT_ELITE' || kind === 'DEFEAT_DEPTH_BOSS') {
    return depth >= 2
      ? { text: `Complete in Depth ${depth}+.`, kind: 'DEPTH_EXTRACT' }
      : { text: 'Defeat an additional elite.', kind: 'ELITE_KILL' };
  }
  if (kind === 'REACH_DEPTH_AND_EXTRACT' || kind === 'RECOVER_APEX_CARGO') {
    return { text: 'Extract without using Dirty Extraction.', kind: 'SAFE_EXTRACTION' };
  }
  if (kind === 'EXTRACT_UNSTABLE_CARGO' || kind === 'RECOVER_CONTRABAND') {
    return { text: `Extract from Depth ${Math.max(2, depth)}+.`, kind: 'DEPTH_EXTRACT' };
  }
  if (kind === 'CLEAR_OPERATION_TARGET') {
    return { text: 'Clear target in Depth 2+.', kind: 'DEPTH_EXTRACT' };
  }
  return rand() < 0.3 ? { text: 'Extract before Depth 3.', kind: 'EARLY_EXTRACTION' } : undefined;
}

function scaleContractReward(
  base: ContractRewardPackage,
  source: ContractSourceKind,
  depth: RunDepth,
  difficulty: number,
): ContractRewardPackage {
  let creditMult = 1;
  if (source === 'OPERATION_ALIGNED') creditMult += 0.1;
  if (source === 'ANCHOR_ALIGNED') creditMult += 0.12;
  if (depth >= 2) creditMult += 0.15;
  if (depth >= 3) creditMult += 0.15;
  if (source === 'WILDCARD') creditMult += 0.2;
  if (difficulty >= 4) creditMult += 0.1;
  return {
    ...base,
    credits: Math.round(base.credits * creditMult),
    reputation: base.reputation + (source === 'OPERATION_ALIGNED' ? 1 : 0),
  };
}

function rewardForSpec(spec: ContractTemplateSpec, sponsorId: CabalEmployerId, difficulty: number, kind: ContractObjectiveKind): ContractRewardPackage {
  const base = spec.rewardFor(sponsorId, difficulty);
  if (kind === 'COMPLETE_EMERGENCY_RECALL' && !base.rareLootBonusPct) {
    return { ...base, rareLootBonusPct: CONTRACT_EMERGENCY_RECALL_RARE_LOOT_PCT };
  }
  const row = contractCreditsForKind(kind, difficulty);
  return buildContractRewardPackage(sponsorId, row.credits, row.reputation);
}

function buildBoundContext(
  ctx: ContractGenerationContext,
  source: ContractSourceKind,
  resourceIds: ResourceItemId[],
  depth: RunDepth,
): ContractBoundContext {
  return {
    sectorId: ctx.sectorId,
    operationId: ctx.activeOperation?.id,
    operationTitle: ctx.activeOperation?.title,
    operationKind: ctx.activeOperation?.objectiveKind,
    anchorType: ctx.activeAnchor?.type,
    anchorDisplayName: ctx.activeAnchor?.displayName,
    resourceIds: resourceIds.length > 0 ? resourceIds : undefined,
    targetDepths: [depth],
    reason: source,
  };
}

function isDuplicateContract(
  contract: GeneratedContract,
  memory: ContractProceduralMemory,
  boardContracts: GeneratedContract[],
): boolean {
  const sponsor = contract.sponsorId;
  const recentKinds = memory.recentContractKindsBySponsor[sponsor] ?? [];
  if (recentKinds[0] === contract.objectiveKind && boardContracts.some(
    (c) => c.sponsorId === sponsor && c.objectiveKind === contract.objectiveKind,
  )) return true;
  if (contract.titleHash) {
    const recentHashes = memory.recentContractTitleHashesBySponsor[sponsor] ?? [];
    if (recentHashes.includes(contract.titleHash)) return true;
  }
  const resId = contract.targetResourceId ?? contract.targetResourceOptions?.[0];
  if (resId) {
    const recentRes = memory.recentContractResourceIdsBySponsor[sponsor] ?? [];
    if (recentRes[0] === resId && boardContracts.some(
      (c) => (c.targetResourceId ?? c.targetResourceOptions?.[0]) === resId,
    )) return true;
  }
  return false;
}

export function generateContractForSlot(
  ctx: ContractGenerationContext,
  sponsorId: CabalEmployerId,
  slot: number,
  source: ContractSourceKind,
  rand: () => number,
  excludeResources: ResourceItemId[],
): GeneratedContract | null {
  const kind = pickObjectiveKindForSource(source, sponsorId, ctx, rand);
  const spec = CONTRACT_TEMPLATE_SPECS.find((s) => s.kind === kind);
  if (!spec || !spec.sponsors.includes(sponsorId)) return null;

  const depth: RunDepth = source === 'DEPTH_PRESSURE'
    ? (rand() < 0.35 ? 3 : 2)
    : ctx.activeOperation?.targetDepths?.[0] ?? (rand() < 0.4 ? 2 : 1);

  let targetResourceId: ResourceItemId | undefined;
  let targetResourceOptions: ResourceItemId[] | undefined;
  let targetQuantity = 1;

  const needsResource = [
    'EXTRACT_STABLE_RESOURCE', 'EXTRACT_SPONSOR_RESOURCE', 'EXTRACT_UNSTABLE_CARGO',
    'RECOVER_APEX_CARGO', 'RECOVER_CONTRABAND', 'RECOVER_INTEL', 'RECOVER_ECONOMY_INTEL',
  ].includes(kind);

  if (needsResource) {
    const picked = pickResourceForContext(ctx, sponsorId, source, rand, excludeResources);
    if (!picked) return null;
    targetResourceId = picked;
    targetQuantity = kind === 'EXTRACT_STABLE_RESOURCE' ? 2 + Math.floor(rand() * 3) : 1;
    if (kind === 'RECOVER_ECONOMY_INTEL') {
      if (rand() < 0.5) {
        targetResourceId = 'smugglers-ledger';
        targetQuantity = 1;
      } else {
        targetResourceId = 'tarnished-dog-tags';
        targetQuantity = 3;
      }
    }
    if (kind === 'RECOVER_INTEL') {
      targetResourceId = 'encrypted-grid-drive';
      targetQuantity = 1;
    }
    if (kind === 'RECOVER_APEX_CARGO') {
      targetResourceId = 'anomalous-core';
      targetQuantity = 1;
    }
    if (kind === 'RECOVER_CONTRABAND') {
      targetResourceId = rand() < 0.5 ? 'sealed-containment-casket' : 'blacksite-specimen-jar';
      targetQuantity = 1;
    }
    if (kind === 'EXTRACT_UNSTABLE_CARGO') {
      const pool = ['veil-ash-canister', 'ossified-ley-knot', 'anchor-marrow', 'breach-thread'] as ResourceItemId[];
      const a = pickOne(pool.filter((id) => canResourceSpawnInSector(id, ctx.sectorId)), rand);
      const b = pickOne(pool.filter((id) => id !== a && canResourceSpawnInSector(id, ctx.sectorId)), rand);
      targetResourceOptions = [a, b];
      targetResourceId = undefined;
      targetQuantity = 1;
    }
  }

  const resourceIds = targetResourceOptions?.length ? targetResourceOptions : targetResourceId ? [targetResourceId] : [];
  const validSectorIds = resourceIds.length > 0
    ? validSectorsForResources(resourceIds)
    : (['THE_SLAG_WORKS', 'THE_NULL_ZONE', 'THE_BLACKLINE_TERMINUS', 'THE_ASHEN_WASTES', 'THE_ABYSSAL_SINK'] as SectorId[]);

  const placeholders = buildPlaceholderContext(ctx, sponsorId, targetResourceId ?? resourceIds[0] ?? null, targetQuantity, depth);
  const variants = CONTRACT_TEXT_VARIANTS[kind];
  let title = fillContractTemplate(pickOne(variants.titleVariants, rand), placeholders);
  let objectiveText = fillContractTemplate(pickOne(variants.descriptionVariants, rand), placeholders);
  if (hasUnresolvedPlaceholders(title)) title = `${sponsorDisplayLabel(sponsorId)}: ${spec.titlePrefix}`;
  if (hasUnresolvedPlaceholders(objectiveText)) {
    objectiveText = spec.buildObjectiveText({ sponsorId, seed: ctx.seed, rng: rand });
  }
  const prefix = pickOne(SPONSOR_TITLE_PREFIXES[sponsorId], rand);
  if (rand() < 0.4 && !title.startsWith(prefix)) title = `${prefix} ${title}`;

  const difficulty = Math.min(5, Math.max(1, spec.difficultyBase + (source === 'WILDCARD' || source === 'DEPTH_PRESSURE' ? 1 : 0))) as GeneratedContract['difficulty'];
  const eliteKills = kind === 'DEFEAT_ELITE' ? 1 + Math.floor(rand() * 2) : (spec.requiredEliteKills ?? 1);
  if (kind === 'DEFEAT_ELITE') {
    objectiveText = `Defeat ${eliteKills} elite encounter${eliteKills > 1 ? 's' : ''} in ${ctx.sectorDisplayName} before extracting.`;
  }

  const titleHash = hashContractTitle(title);
  const bonusObjective = rollBonusObjective(kind, depth, rand);
  let reward = scaleContractReward(rewardForSpec(spec, sponsorId, difficulty, kind), source, depth, difficulty);

  return {
    id: `${sponsorId.toLowerCase()}-${kind.toLowerCase()}-${ctx.deployRunIndex}-${slot}`,
    sponsorId,
    title,
    objectiveKind: kind,
    objectiveText,
    targetResourceId,
    targetResourceOptions,
    targetQuantity,
    targetCategory: targetResourceId ? getResourceCategory(targetResourceId) : undefined,
    validSectorIds,
    recommendedSectorIds: recommendedSectorsForContract(targetResourceId, targetResourceOptions, validSectorIds, ctx),
    requiredDepth: kind === 'REACH_DEPTH_AND_EXTRACT' || kind === 'RECOVER_APEX_CARGO'
      ? (kind === 'RECOVER_APEX_CARGO' ? 3 : depth) : spec.requiredDepth ?? (source === 'DEPTH_PRESSURE' ? depth : undefined),
    requiresEmergencyRecall: spec.requiresEmergencyRecall,
    requiredEliteKills: eliteKills,
    requiredOperationTargets: spec.requiredOperationTargets,
    bonusObjective,
    reward,
    bonusReward: bonusObjective ? { credits: Math.round(reward.credits * 0.25), reputation: 1 }
      : kind === 'RECOVER_ECONOMY_INTEL' ? { credits: 40, reputation: 1 } : undefined,
    difficulty,
    minBreachGrade: minBreachGradeForContractDifficulty(difficulty),
    refreshLabel: 'Refreshes after run',
    boundContext: buildBoundContext(ctx, source, resourceIds, depth),
    titleHash,
    recentMemoryKey: `${ctx.sectorId}:${sponsorId}:${kind}:${titleHash}`,
    generationDebug: { selectedWeightReason: source, sourceWeights: resolveContractSourceWeights(ctx) },
  };
}

export function validateProceduralContract(contract: GeneratedContract, ctx: ContractGenerationContext): boolean {
  if (hasUnresolvedPlaceholders(contract.title) || hasUnresolvedPlaceholders(contract.objectiveText)) return false;
  if (contract.reward.credits <= 0) return false;
  if (contract.boundContext?.reason === 'OPERATION_ALIGNED' && !ctx.activeOperation) return false;
  if (contract.boundContext?.reason === 'ANCHOR_ALIGNED' && !ctx.activeAnchor) return false;
  const resourceIds = contract.targetResourceOptions?.length ? contract.targetResourceOptions
    : contract.targetResourceId ? [contract.targetResourceId] : [];
  if (resourceIds.length > 0) {
    const spawnable = resourceIds.some((id) => canResourceSpawnInSector(id, ctx.sectorId));
    if (!spawnable && !contract.validSectorIds.some((s) => resourceIds.some((id) => canResourceSpawnInSector(id, s)))) {
      return false;
    }
  }
  return true;
}

export function generateContractBoardV2(
  opts: GenerateContractBoardOptions,
): { contracts: GeneratedContract[]; memory: ContractProceduralMemory } {
  const ctx = buildContractGenerationContext(opts);
  const weights = resolveContractSourceWeights(ctx);
  const rand = seededRandom(`board-v2:${ctx.seed}`);
  const contracts: GeneratedContract[] = [];
  const usedResources: ResourceItemId[] = [];
  let memory = ctx.recentContractMemory;

  (Object.keys(SPONSOR_CONTRACT_QUOTAS) as CabalEmployerId[]).forEach((sponsorId) => {
    const quota = SPONSOR_CONTRACT_QUOTAS[sponsorId];
    let slot = 0;
    while (contracts.filter((c) => c.sponsorId === sponsorId).length < quota) {
      const preferred = SOURCE_SLOT_PREFERENCES[slot] ?? SOURCE_SLOT_PREFERENCES[1]!;
      let generated: GeneratedContract | null = null;
      for (let attempt = 0; attempt < CONTRACT_BOARD_REROLL_ATTEMPTS; attempt += 1) {
        const source = weightedPickSource(weights, preferred, rand);
        const candidate = generateContractForSlot(ctx, sponsorId, contracts.length, source, rand, usedResources);
        if (!candidate || !validateProceduralContract(candidate, ctx) || isDuplicateContract(candidate, memory, contracts)) continue;
        generated = candidate;
        break;
      }
      if (!generated) {
        const fallback = generateContractForSlot(ctx, sponsorId, contracts.length, 'SECTOR_RESOURCE', rand, usedResources);
        if (fallback && validateProceduralContract(fallback, ctx)) generated = fallback;
      }
      if (generated) {
        contracts.push(generated);
        const res = generated.targetResourceId ?? generated.targetResourceOptions?.[0];
        if (res) usedResources.push(res);
      }
      slot += 1;
      if (slot > quota * 3) break;
    }
  });

  if (contracts.length < 6) {
    sectorResourceIds(ctx.sectorId, ctx).slice(0, 6 - contracts.length).forEach((resourceId, index) => {
      const sponsorId: CabalEmployerId = index % 3 === 0 ? 'TERRAN_GRID' : index % 3 === 1 ? 'LEGION' : 'SOLARIS';
      if (contracts.filter((c) => c.sponsorId === sponsorId).length >= 2) return;
      const def = getResourceDefinition(resourceId);
      contracts.push({
        id: `fallback-v2-${ctx.deployRunIndex}-${resourceId}`,
        sponsorId,
        title: `${sponsorDisplayLabel(sponsorId)}: ${def.shortName} Recovery`,
        objectiveKind: 'EXTRACT_STABLE_RESOURCE',
        objectiveText: `Extract 1 ${def.name} from ${ctx.sectorDisplayName}.`,
        targetResourceId: resourceId,
        targetQuantity: 1,
        targetCategory: def.category,
        validSectorIds: def.validSectorIds,
        recommendedSectorIds: [ctx.sectorId],
        reward: buildContractRewardPackage(sponsorId, 100, 2),
        difficulty: 2,
        refreshLabel: 'Refreshes after run',
        boundContext: { sectorId: ctx.sectorId, reason: 'SECTOR_RESOURCE', resourceIds: [resourceId] },
        titleHash: hashContractTitle(`${def.shortName} Recovery`),
        recentMemoryKey: `fallback:${resourceId}`,
      });
    });
  }

  memory = recordContractsInMemory(memory, contracts);
  return { contracts: contracts.slice(0, 6), memory };
}

export function buildContractBoardFromPersisted(
  persisted: WorldStatePersistedState,
  sectorState: {
    id: SectorId;
    activeOperation: OperationState;
    activeAnchor: VeilAnchorState | null;
    resourceFocus: string[];
    hazardLevel: number;
    rewardLevel: number;
    echoActivity: EchoActivityLevel;
  },
  briefContext?: Pick<
    GenerateContractBoardOptions,
    'crisisTheme' | 'resourceStress' | 'threatProfile' | 'contractBias' | 'sponsorInterest'
  >,
): { contracts: GeneratedContract[]; memory: ContractProceduralMemory } {
  return generateContractBoardV2({
    deployRunIndex: persisted.deployRunIndex,
    sectorId: sectorState.id,
    activeOperation: sectorState.activeOperation,
    activeAnchor: sectorState.activeAnchor,
    sectorResourceFocus: sectorState.resourceFocus,
    hazardLevel: sectorState.hazardLevel,
    rewardLevel: sectorState.rewardLevel,
    echoActivity: sectorState.echoActivity,
    recentContractMemory: getContractMemory(persisted),
    ...briefContext,
  });
}
