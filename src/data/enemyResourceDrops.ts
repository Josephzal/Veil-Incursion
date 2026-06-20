import type { EnemyCombatProfile } from '../types/run';
import type { ResourceItemId } from '../types/resourceItem';
import type { EnemyRosterId } from './enemyRoster';

export interface EnemyDropEntry {
  /** Primary salvage resource for this enemy type. */
  primary: ResourceItemId;
  /** Optional bonus pool rolled at lower weight. */
  bonus?: ReadonlyArray<ResourceItemId>;
}

/**
 * Per-enemy salvage mapping — aligned to the master economy roster.
 * Enemies without an entry fall back to tier/faction pools in combatRewardEngine.
 */
export const ENEMY_RESOURCE_DROPS: Partial<Record<EnemyRosterId, EnemyDropEntry>> = {
  // Foundation & scavenge
  'fracture-hound': { primary: 'ley-slag' },
  'concrete-gargoyle': { primary: 'ley-slag' },
  'spatial-glitch': { primary: 'echo-glass-shard' },
  'resonance-caster': { primary: 'echo-glass-shard' },
  'echoing-brute': { primary: 'tarnished-dog-tags', bonus: ['legion-blood-iron'] },
  'thrall': { primary: 'tarnished-dog-tags' },

  // Biotic & occult
  'ley-siren': { primary: 'sanguine-ampoule' },
  'ash-weeper': { primary: 'sanguine-ampoule' },
  'null-shade': { primary: 'ossified-ley-knot' },
  'hook-weaver': { primary: 'ossified-ley-knot' },

  // Tech & heavy
  'memory-leech': { primary: 'encrypted-grid-drive' },
  'smog-caller': { primary: 'encrypted-grid-drive' },
  'gutter-goliath': { primary: 'legion-blood-iron' },
  'slag-blood': { primary: 'legion-blood-iron' },
  'sapper': { primary: 'combustion-cylinder' },
  'coil-spike-sniper': { primary: 'combustion-cylinder' },

  // Hazard & barter
  'miasma-tick-swarm': { primary: 'veil-ash-canister' },
  'tar-spitter': { primary: 'veil-ash-canister' },
  'golem': { primary: 'veil-ash-canister' },

  // Apex
  'boss-hollowed-precinct': { primary: 'anomalous-core' },
  'boss-choir-of-rust': { primary: 'anomalous-core' },
  'boss-primeval-rift-walker': { primary: 'anomalous-core' },
};

const BONUS_DROP_CHANCE = 0.25;

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

export function getEnemyDropEntry(rosterId: string | null | undefined): EnemyDropEntry | null {
  if (!rosterId) return null;
  return ENEMY_RESOURCE_DROPS[rosterId as EnemyRosterId] ?? null;
}

export function rollEnemyResourceDrop(
  rosterId: string,
  seed: string,
): ResourceItemId | null {
  const entry = getEnemyDropEntry(rosterId);
  if (!entry) return null;

  const rng = createSeededRng(seed);
  if (entry.bonus && entry.bonus.length > 0 && rng() < BONUS_DROP_CHANCE) {
    return entry.bonus[Math.floor(rng() * entry.bonus.length)];
  }
  return entry.primary;
}

export function collectEnemyResourceLoot(
  enemies: Array<Pick<EnemyCombatProfile, 'rosterId' | 'currentHp' | 'isSlumped'>>,
  seed: string,
): ResourceItemId[] {
  const drops: ResourceItemId[] = [];
  enemies.forEach((enemy, index) => {
    if (enemy.currentHp > 0 || enemy.isSlumped) return;
    if (!enemy.rosterId) return;
    const drop = rollEnemyResourceDrop(
      enemy.rosterId,
      `${seed}:enemy:${enemy.rosterId}:${index}`,
    );
    if (drop) drops.push(drop);
  });
  return drops;
}
