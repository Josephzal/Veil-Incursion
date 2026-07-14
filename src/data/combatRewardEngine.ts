import type { ResourceItemId } from '../types/resourceItem';
import type { EnemyCombatProfile } from '../types/run';
import { collectEnemyResourceLoot } from './enemyResourceDrops';
import { ENEMY_ROSTER, type EnemyRosterId } from './enemyRoster';
import {
  compositionExtraLootIds,
  compositionRareLootBonusPct,
} from './encounterCompositionRewardEngine';
import {
  rollExpansionIdentityExtras,
  sectorIdentityResourcePool,
} from './resourceDropIdentityEngine';
import { getDistrictFromDepth } from './districtPacing';

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

const GATEKEEPER_DROPS: ResourceItemId[] = ['anomalous-core', 'sealed-containment-casket'];

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

function pickBiasedFromPool(
  pool: ResourceItemId[],
  profile: CombatLootProfile,
  rng: () => number,
  veilBiome?: import('../types/encounterSpawn').VeilBiome | null,
): ResourceItemId {
  const sectorBias = sectorIdentityResourcePool(veilBiome).filter((id) => pool.includes(id));
  if (sectorBias.length > 0 && rng() < 0.55) {
    return pickFromPool(sectorBias, rng);
  }
  const biasPool = FACTION_BIAS[profile].filter((id) => pool.includes(id));
  if (biasPool.length > 0 && rng() < 0.7) {
    return pickFromPool(biasPool, rng);
  }
  return pickFromPool(pool, rng);
}

function factionRarePool(profile: CombatLootProfile, tier: LootDepthTier): ResourceItemId[] {
  const pool = tierResourcePool(tier);
  const biased = FACTION_BIAS[profile].filter((id) => pool.includes(id));
  if (biased.length > 0) return biased;
  const rare = pool.filter((id) => !COMMON_STAPLES.includes(id));
  return rare.length > 0 ? rare : pool;
}

function pickEliteDrops(
  profile: CombatLootProfile,
  tier: LootDepthTier,
  rng: () => number,
): ResourceItemId[] {
  const rare = factionRarePool(profile, tier);
  return [pickFromPool(rare, rng), pickFromPool(rare, rng)];
}

export function rollCombatResourceDrops(ctx: CombatRewardContext): ResourceItemId[] {
  const seed = ctx.seed ?? `combat-loot:${ctx.depth}:${ctx.rosterId ?? 'unknown'}`;
  const rng = createSeededRng(seed);
  const tier = lootDepthTierFromDepth(ctx.depth);
  const profile = resolveCombatLootProfile(ctx.rosterId);
  const drops: ResourceItemId[] = [];

  if (ctx.isGatekeeper) {
    return [];
  }

  const enemyLoot = ctx.slainEnemies?.length
    ? collectEnemyResourceLoot(ctx.slainEnemies, seed)
    : [];
  drops.push(...enemyLoot);

  const compositionRarePct = compositionRareLootBonusPct(ctx.rewardTier);
  const rareLootBonusPct = (ctx.rareLootBonusPct ?? 0) + compositionRarePct;
  const compositionExtras = compositionExtraLootIds({
    tier: ctx.rewardTier,
    templateId: ctx.compositionTemplateId,
    veilBiome: ctx.veilBiome,
    highValue: ctx.highValue,
    echoSignal: ctx.echoSignal,
    anchorSignal: ctx.anchorSignal,
  });
  const districtDepth = ctx.districtDepth ?? getDistrictFromDepth(ctx.depth);
  const identityExtras = rollExpansionIdentityExtras({
    districtDepth,
    veilBiome: ctx.veilBiome,
    isElite: ctx.isElite,
    highValue: ctx.highValue,
    highRisk: ctx.highRisk,
    echoSignal: ctx.echoSignal,
    anchorSignal: ctx.anchorSignal,
    hasModifier: ctx.hasModifier,
    hasTwisted: ctx.hasTwisted,
    templateId: ctx.compositionTemplateId,
    rewardTier: ctx.rewardTier,
    rng,
  });

  if (ctx.isElite) {
    if (enemyLoot.length === 0) {
      drops.push(...pickEliteDrops(profile, tier, rng));
    } else {
      drops.push(pickFromPool(factionRarePool(profile, tier), rng));
    }
    drops.push(...(ctx.extraLoot ?? []));
    drops.push(...compositionExtras);
    drops.push(...identityExtras);
    if (rareLootBonusPct > 0 && rng() * 100 < rareLootBonusPct) {
      drops.push(pickFromPool(factionRarePool(profile, tier), rng));
    }
    // HIGH_VALUE+ gets a second rare chance roll.
    if (
      (ctx.rewardTier === 'HIGH_VALUE' || ctx.rewardTier === 'RARE' || ctx.rewardTier === 'APEX_CHANCE')
      && rng() * 100 < Math.min(35, rareLootBonusPct)
    ) {
      drops.push(pickFromPool(factionRarePool(profile, Math.max(tier, 2) as LootDepthTier), rng));
    }
    const occultBonusPct = ctx.occultRewardBonusPct ?? 0;
    if (occultBonusPct > 0 && rng() * 100 < occultBonusPct) {
      drops.push(pickFromPool(factionRarePool('SOLARIS', tier), rng));
    }
    return drops;
  }

  if (enemyLoot.length === 0) {
    drops.push(pickBiasedFromPool(tierResourcePool(tier), profile, rng, ctx.veilBiome));
  }

  drops.push(...(ctx.extraLoot ?? []));
  drops.push(...compositionExtras);
  drops.push(...identityExtras);

  if (rareLootBonusPct > 0 && rng() * 100 < rareLootBonusPct) {
    drops.push(pickFromPool(factionRarePool(profile, tier), rng));
  }
  if (
    (ctx.rewardTier === 'RARE' || ctx.rewardTier === 'APEX_CHANCE')
    && rng() < 0.35
  ) {
    const apexPool = tier >= 3
      ? [...TIER_3_ADD, ...factionRarePool(profile, 3)]
      : factionRarePool(profile, Math.max(tier, 2) as LootDepthTier);
    drops.push(pickFromPool(apexPool, rng));
  }
  const occultBonusPct = ctx.occultRewardBonusPct ?? 0;
  if (occultBonusPct > 0 && rng() * 100 < occultBonusPct) {
    drops.push(pickFromPool(factionRarePool('SOLARIS', tier), rng));
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
