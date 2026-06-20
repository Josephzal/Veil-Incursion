import type { ResourceItemId } from '../types/resourceItem';
import type { EnemyCombatProfile } from '../types/run';
import { collectEnemyResourceLoot } from './enemyResourceDrops';
import { ENEMY_ROSTER, type EnemyRosterId } from './enemyRoster';

export { collectEnemyResourceLoot } from './enemyResourceDrops';

export type LootDepthTier = 1 | 2 | 3;

export type CombatLootProfile = 'STANDARD' | 'SOLARIS' | 'TERRAN_GRID' | 'LEGION' | 'TOXIC';

const TIER_1_POOL: ResourceItemId[] = [
  'ley-slag',
  'echo-glass-shard',
  'tarnished-dog-tags',
  'sanguine-ampoule',
  'veil-ash-canister',
];

const TIER_2_ADD: ResourceItemId[] = [
  'encrypted-grid-drive',
  'legion-blood-iron',
  'combustion-cylinder',
  'ossified-ley-knot',
  'smugglers-ledger',
];

const TIER_3_ADD: ResourceItemId[] = [
  'anomalous-core',
  'sealed-containment-casket',
];

const COMMON_STAPLES: ResourceItemId[] = ['ley-slag', 'echo-glass-shard'];

const GATEKEEPER_DROPS: ResourceItemId[] = ['anomalous-core', 'sealed-containment-casket'];

const FACTION_BIAS: Record<CombatLootProfile, ResourceItemId[]> = {
  STANDARD: ['ley-slag', 'echo-glass-shard'],
  SOLARIS: ['sanguine-ampoule', 'ossified-ley-knot'],
  TERRAN_GRID: ['encrypted-grid-drive'],
  LEGION: ['legion-blood-iron'],
  TOXIC: ['veil-ash-canister'],
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
  /** Shadow War Null Zone buff — extra salvage roll chance (%). */
  rareLootBonusPct?: number;
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
): ResourceItemId {
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

export function collectFactionTraitLoot(
  enemies: Array<Pick<EnemyCombatProfile, 'isCabalHuman' | 'factionLootId' | 'currentHp' | 'isSlumped'>>,
): ResourceItemId[] {
  const drops: ResourceItemId[] = [];
  for (const enemy of enemies) {
    if (!enemy.isCabalHuman || !enemy.factionLootId) continue;
    if (enemy.currentHp > 0 || enemy.isSlumped) continue;
    drops.push(enemy.factionLootId as ResourceItemId);
  }
  return drops;
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

  if (ctx.isElite) {
    if (enemyLoot.length === 0) {
      drops.push(...pickEliteDrops(profile, tier, rng));
    } else {
      drops.push(pickFromPool(factionRarePool(profile, tier), rng));
    }
    drops.push(...(ctx.extraLoot ?? []));
    const rareBonusPct = ctx.rareLootBonusPct ?? 0;
    if (rareBonusPct > 0 && rng() * 100 < rareBonusPct) {
      drops.push(pickFromPool(factionRarePool(profile, tier), rng));
    }
    return drops;
  }

  if (enemyLoot.length === 0) {
    drops.push(pickBiasedFromPool(tierResourcePool(tier), profile, rng));
  }

  drops.push(...(ctx.extraLoot ?? []));

  const rareBonusPct = ctx.rareLootBonusPct ?? 0;
  if (rareBonusPct > 0 && rng() * 100 < rareBonusPct) {
    drops.push(pickFromPool(factionRarePool(profile, tier), rng));
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
