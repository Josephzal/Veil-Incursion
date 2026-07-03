import type { EncounterEnemyKey } from './enemyCombatConfig';
import {
  ENEMY_DEFINITIONS,
  getEnemyDefinition,
  isDepth3ExclusiveEnemy,
} from './enemyDefinitions';
import type {
  EncounterNodeTier,
  EncounterSquadTier,
  VeilBiome,
} from '../types/encounterSpawn';

export interface SpawnGateContext {
  depth: 1 | 2 | 3;
  nodeIndexInDepth: number;
  /** Combat node tier — NORMAL maps from synergy squads; ELITE/BOSS/ANCHOR for gated elites. */
  nodeTier: EncounterNodeTier;
  veilBiome?: VeilBiome;
}

const ALL_NODE_TIERS: EncounterNodeTier[] = ['NORMAL', 'ELITE', 'BOSS', 'ANCHOR'];

function isEliteOrAbove(tier: EncounterNodeTier): boolean {
  return tier !== 'NORMAL';
}

export function enemyPassesSpawnGates(
  enemyKey: EncounterEnemyKey,
  ctx: SpawnGateContext,
): boolean {
  const def = getEnemyDefinition(enemyKey);
  if (!def) return true;

  const { spawnGates } = def;
  if (!spawnGates.allowedDepths.includes(ctx.depth)) return false;

  if (
    ctx.veilBiome != null
    && def.origin === 'VEIL'
    && !def.biomeTags.includes(ctx.veilBiome)
  ) {
    return false;
  }

  if (!spawnGates.allowedNodeTiers.includes(ctx.nodeTier)) return false;

  if (
    spawnGates.depth1NormalBlocked
    && ctx.depth === 1
    && ctx.nodeTier === 'NORMAL'
  ) {
    return false;
  }

  if (
    spawnGates.normalOnlyAfterNode != null
    && ctx.depth === 1
    && ctx.nodeTier === 'NORMAL'
    && ctx.nodeIndexInDepth < spawnGates.normalOnlyAfterNode
  ) {
    return false;
  }

  if (
    spawnGates.minNodeIndexInDepth != null
    && ctx.nodeIndexInDepth < spawnGates.minNodeIndexInDepth
    && !isEliteOrAbove(ctx.nodeTier)
  ) {
    return false;
  }

  return true;
}

export function squadUnitKeysPassSpawnGates(
  unitKeys: readonly EncounterEnemyKey[],
  ctx: SpawnGateContext,
): boolean {
  return unitKeys.every((key) => enemyPassesSpawnGates(key, ctx));
}

/** Depth-only gate — used when node index / tier are not yet known. */
export function enemyAllowedAtDepth(
  enemyKey: EncounterEnemyKey,
  depth: 1 | 2 | 3,
): boolean {
  const def = getEnemyDefinition(enemyKey);
  if (!def) return true;
  return def.spawnGates.allowedDepths.includes(depth);
}

export function squadAllowedAtDepth(
  unitKeys: readonly EncounterEnemyKey[],
  depth: 1 | 2 | 3,
): boolean {
  return unitKeys.every((key) => enemyAllowedAtDepth(key, depth));
}

export function nodeTierFromSquadTier(tier: EncounterSquadTier): EncounterNodeTier {
  return tier === 'ELITE' ? 'ELITE' : 'NORMAL';
}

export function verifyEnemyDefinitions(): void {
  for (const [key, def] of Object.entries(ENEMY_DEFINITIONS)) {
    if (def.id !== key) {
      throw new Error(`verifyEnemyDefinitions: id mismatch ${key} vs ${def.id}`);
    }
    if (def.spawnGates.allowedNodeTiers.length === 0) {
      throw new Error(`verifyEnemyDefinitions: ${key} has no allowedNodeTiers`);
    }
    if (def.spawnGates.allowedDepths.length === 0) {
      throw new Error(`verifyEnemyDefinitions: ${key} has no allowedDepths`);
    }
    if (def.origin === 'RIVAL_MERC' && def.biomeTags.length !== 5) {
      throw new Error(`verifyEnemyDefinitions: ${key} rival must span all biomes`);
    }
    if (def.origin === 'VEIL' && def.biomeTags.length === 0) {
      throw new Error(`verifyEnemyDefinitions: ${key} veil unit needs biomeTags`);
    }
  }

  for (const key of Object.keys(ENEMY_DEFINITIONS) as EncounterEnemyKey[]) {
    if (isDepth3ExclusiveEnemy(key)) {
      const def = getEnemyDefinition(key)!;
      if (def.spawnGates.allowedDepths.some((d) => d < 3)) {
        throw new Error(`verifyEnemyDefinitions: depth-3 exclusive ${key} allows shallow depth`);
      }
    }
  }
}

export { ALL_NODE_TIERS };
