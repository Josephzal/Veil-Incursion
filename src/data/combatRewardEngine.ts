import type { ResourceItemId } from '../types/resourceItem';
import type { EnemyCombatProfile } from '../types/run';
import type { BreachGradeId } from '../types/progression';
import { collectEnemyResourceLoot } from './enemyResourceDrops';
import { ENEMY_ROSTER, type EnemyRosterId } from './enemyRoster';
import {
  compositionExtraLootIds,
  compositionRareLootBonusPct,
} from './encounterCompositionRewardEngine';
import {
  sectorIdentityResourcePool,
} from './resourceDropIdentityEngine';
import { getDistrictFromDepth } from './districtPacing';
import {
  filterResourcesForDepth,
  pickWeightedForDepth,
} from './depthResourceRulesEngine';
import type { ResourceDepthIndex } from '../types/resourceItem';
import {
  resolveCombatRewardNodeKind,
  rollNodeRewardPackets,
  sectorIdFromVeilBiome,
} from './resourceRewardPacketEngine';

export { collectEnemyResourceLoot } from './enemyResourceDrops';

export type LootDepthTier = 1 | 2 | 3;

export type CombatLootProfile = 'STANDARD' | 'SOLARIS' | 'TERRAN_GRID' | 'LEGION' | 'TOXIC';

const TIER_1_POOL: ResourceItemId[] = [
  'ley-slag',
  'echo-glass-shard',
  'tarnished-dog-tags',
  'sanguine-ampoule',
  'veil-ash-canister',
  'nullcrete-shard',
  'cinder-wire',
];

const TIER_2_ADD: ResourceItemId[] = [
  'encrypted-grid-drive',
  'legion-blood-iron',
  'combustion-cylinder',
  'ossified-ley-knot',
  'smugglers-ledger',
  'mycelial-ichor',
  'rail-capacitor',
  'containment-seal',
  'resonant-filament',
];

const TIER_3_ADD: ResourceItemId[] = [
  'anomalous-core',
  'sealed-containment-casket',
  'anchor-marrow',
  'breach-thread',
  'blacksite-specimen-jar',
];

const COMMON_STAPLES: ResourceItemId[] = [
  'ley-slag',
  'echo-glass-shard',
  'nullcrete-shard',
  'cinder-wire',
];

const FACTION_BIAS: Record<CombatLootProfile, ResourceItemId[]> = {
  STANDARD: ['ley-slag', 'echo-glass-shard', 'nullcrete-shard', 'cinder-wire'],
  SOLARIS: ['sanguine-ampoule', 'ossified-ley-knot', 'mycelial-ichor', 'breach-thread'],
  TERRAN_GRID: ['encrypted-grid-drive', 'containment-seal', 'rail-capacitor'],
  LEGION: ['legion-blood-iron', 'rail-capacitor', 'combustion-cylinder'],
  TOXIC: ['veil-ash-canister', 'mycelial-ichor'],
};

const TOXIC_ROSTER_IDS = new Set<EnemyRosterId>(['miasma-tick-swarm', 'ash-weeper']);

export interface CombatRewardContext {
  depth: number;
  isElite: boolean;
  isGatekeeper: boolean;
  rosterId?: string | null;
  seed?: string;
  extraLoot?: ResourceItemId[];
  /** Slain squad members — drives per-enemy salvage tables. */
  slainEnemies?: Array<Pick<EnemyCombatProfile, 'rosterId' | 'currentHp' | 'isSlumped'>>;
  /** Run modifier — extra salvage roll chance (%). */
  rareLootBonusPct?: number;
  /** Carried unstable cargo — occult-biased salvage roll chance (%). */
  occultRewardBonusPct?: number;
  /** Phase C — composition reward tier scales salvage pressure. */
  rewardTier?: import('../types/encounterComposition').EncounterRewardTier | null;
  /** Phase C — template / biome biased extras. */
  compositionTemplateId?: import('../types/encounterComposition').EncounterCompositionTemplateId | null;
  veilBiome?: import('../types/encounterSpawn').VeilBiome | null;
  highValue?: boolean;
  echoSignal?: boolean;
  anchorSignal?: boolean;
  /** District depth (1–3) for Breach / Anchor / Specimen gating. */
  districtDepth?: 1 | 2 | 3;
  highRisk?: boolean;
  hasModifier?: boolean;
  hasTwisted?: boolean;
  /** RunWorldBrief — prioritize crisis-stressed resources in salvage rolls. */
  stressedResourceIds?: ResourceItemId[];
  briefRewardBias?: import('../types/runWorldBrief').RunRewardBias | null;
  /** Phase 2F — Breach Grade packet quality (not pile multipliers). */
  breachGrade?: BreachGradeId | null;
  contractTargetIds?: readonly ResourceItemId[];
  operationTargetIds?: readonly ResourceItemId[];
  /** Force packet node kind (RESOURCE_ANOMALY / BOSS / etc.). */
  rewardNodeKind?: import('../types/resourceRewardPacket').RewardNodeKind | null;
}

export function lootDepthTierFromDepth(depth: number): LootDepthTier {
  if (depth <= 15) return 1;
  if (depth <= 30) return 2;
  return 3;
}

export function tierResourcePool(tier: LootDepthTier): ResourceItemId[] {
  if (tier === 1) return [...TIER_1_POOL];
  if (tier === 2) return [...TIER_1_POOL, ...TIER_2_ADD];
  return [...TIER_1_POOL, ...TIER_2_ADD, ...TIER_3_ADD];
}

/** Phase 2E — tier pool filtered by district depth rules + category policy. */
export function depthAwareTierResourcePool(
  tier: LootDepthTier,
  districtDepth: ResourceDepthIndex,
  opts?: { isElite?: boolean; highRisk?: boolean },
): ResourceItemId[] {
  return filterResourcesForDepth(tierResourcePool(tier), districtDepth, opts);
}

export function resolveCombatLootProfile(rosterId?: string | null): CombatLootProfile {
  if (!rosterId) return 'STANDARD';
  if (TOXIC_ROSTER_IDS.has(rosterId as EnemyRosterId)) return 'TOXIC';
  const entry = ENEMY_ROSTER[rosterId as EnemyRosterId];
  if (!entry) return 'STANDARD';
  if (entry.faction === 'SOLARIS') return 'SOLARIS';
  if (entry.faction === 'TERRAN_GRID') return 'TERRAN_GRID';
  if (entry.faction === 'LEGION') return 'LEGION';
  return 'STANDARD';
}

function createSeededRng(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return () => {
    hash = (hash * 1664525 + 1013904223) >>> 0;
    return hash / 0xffffffff;
  };
}

function pickFromPool(pool: ResourceItemId[], rng: () => number): ResourceItemId {
  return pool[Math.floor(rng() * pool.length)];
}

function factionRarePool(
  profile: CombatLootProfile,
  tier: LootDepthTier,
  districtDepth: ResourceDepthIndex,
  opts?: { isElite?: boolean; highRisk?: boolean },
): ResourceItemId[] {
  const pool = depthAwareTierResourcePool(tier, districtDepth, opts);
  const biased = FACTION_BIAS[profile].filter((id) => pool.includes(id));
  if (biased.length > 0) return biased;
  const rare = pool.filter((id) => !COMMON_STAPLES.includes(id));
  return rare.length > 0 ? rare : pool;
}

/**
 * Phase 2F — combat salvage = enemy tables + reward packets (+ light composition/occult).
 * Gatekeeper bosses still receive BOSS packets; locked containers remain separate.
 */
export function rollCombatResourceDrops(ctx: CombatRewardContext): ResourceItemId[] {
  const seed = ctx.seed ?? `combat-loot:${ctx.depth}:${ctx.rosterId ?? 'unknown'}`;
  const rng = createSeededRng(seed);
  const tier = lootDepthTierFromDepth(ctx.depth);
  const profile = resolveCombatLootProfile(ctx.rosterId);
  const drops: ResourceItemId[] = [];
  const districtDepth = (ctx.districtDepth ?? getDistrictFromDepth(ctx.depth)) as ResourceDepthIndex;
  const depthOpts = {
    isElite: ctx.isElite || ctx.isGatekeeper,
    highRisk: Boolean(
      ctx.highRisk
      || ctx.rewardTier === 'APEX_CHANCE'
      || ctx.rewardTier === 'RARE'
      || ctx.isGatekeeper,
    ),
  };

  const rawEnemyLoot = ctx.slainEnemies?.length
    ? collectEnemyResourceLoot(ctx.slainEnemies, seed)
    : [];
  const enemyLoot = filterResourcesForDepth(rawEnemyLoot, districtDepth, depthOpts);
  drops.push(...enemyLoot);

  const compositionRarePct = compositionRareLootBonusPct(ctx.rewardTier);
  let rareLootBonusPct = (ctx.rareLootBonusPct ?? 0) + compositionRarePct;
  if (ctx.briefRewardBias?.rareLootMultiplier && ctx.briefRewardBias.rareLootMultiplier > 1) {
    rareLootBonusPct += Math.min(12, Math.round((ctx.briefRewardBias.rareLootMultiplier - 1) * 80));
  }

  const nodeKind = ctx.rewardNodeKind ?? resolveCombatRewardNodeKind({
    isElite: ctx.isElite,
    isBoss: ctx.isGatekeeper,
    isGatekeeper: ctx.isGatekeeper,
    echoSignal: ctx.echoSignal,
    anchorSignal: ctx.anchorSignal,
  });

  const packetResult = rollNodeRewardPackets({
    nodeKind,
    depth: ctx.depth,
    districtDepth,
    veilBiome: ctx.veilBiome,
    sectorId: sectorIdFromVeilBiome(ctx.veilBiome),
    breachGrade: ctx.breachGrade ?? 'I',
    isElite: ctx.isElite || ctx.isGatekeeper,
    highRisk: depthOpts.highRisk,
    highValue: ctx.highValue,
    echoSignal: ctx.echoSignal,
    anchorSignal: ctx.anchorSignal,
    contractTargetIds: ctx.contractTargetIds,
    operationTargetIds: ctx.operationTargetIds,
    stressedResourceIds: ctx.stressedResourceIds,
    briefRewardBias: ctx.briefRewardBias,
    rareLootBonusPct,
    rng,
  });
  drops.push(...packetResult.resourceIds);

  // Light composition identity extras (templates) — still depth-gated.
  const compositionExtras = filterResourcesForDepth(
    compositionExtraLootIds({
      tier: ctx.rewardTier,
      templateId: ctx.compositionTemplateId,
      veilBiome: ctx.veilBiome,
      highValue: ctx.highValue,
      echoSignal: false,
      anchorSignal: false,
    }),
    districtDepth,
    depthOpts,
  );
  drops.push(...compositionExtras);
  drops.push(...filterResourcesForDepth(ctx.extraLoot ?? [], districtDepth, depthOpts));

  const occultBonusPct = ctx.occultRewardBonusPct ?? 0;
  if (occultBonusPct > 0 && rng() * 100 < occultBonusPct) {
    const occult = factionRarePool('SOLARIS', tier, districtDepth, depthOpts);
    if (occult.length > 0) {
      drops.push(pickWeightedForDepth(occult, districtDepth, rng) ?? pickFromPool(occult, rng));
    }
  }

  // Faction staple bias when packets somehow empty and no enemy loot.
  if (drops.length === 0) {
    const fallback = filterResourcesForDepth(
      sectorIdentityResourcePool(ctx.veilBiome),
      districtDepth,
      depthOpts,
    );
    if (fallback.length > 0) {
      drops.push(pickWeightedForDepth(fallback, districtDepth, rng) ?? pickFromPool(fallback, rng));
    }
  }

  return drops;
}

export function rollGatekeeperLockedTemplate(seed?: string): import('../types/unidentifiedItem').UnidentifiedTemplateId {
  const rng = createSeededRng(seed ?? `gatekeeper:${Date.now()}`);
  return rng() < 0.5 ? 'item_core_tier1' : 'item_casket_tier1';
}

export function formatCombatResourceDropLog(drops: ResourceItemId[]): string {
  if (drops.length === 0) return '>> NO SALVAGEABLE RESOURCES RECOVERED.';
  const counts = drops.reduce<Partial<Record<ResourceItemId, number>>>((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(counts)
    .map(([id, count]) => `${count}x ${id.replace(/-/g, ' ').toUpperCase()}`)
    .join(' // ');
  return `>> COMBAT SALVAGE SECURED — ${summary}`;
}
