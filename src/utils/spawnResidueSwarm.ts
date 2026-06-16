import type { ActiveIncursionState } from '../types/game';
import type { HarvestFloorBounds, ResidueEnemyTier, ResidueParticleData } from '../types/residueParticle';

let particleSeq = 0;

function nextParticleId(): string {
  particleSeq += 1;
  return `residue-particle-${Date.now()}-${particleSeq}`;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/** Base particle counts per drop — doubled for denser swarms; values still sum to totalValue. */
function particleCountForTier(tier: ResidueEnemyTier): number {
  switch (tier) {
    case 'elite':
      return randomInt(12, 20);
    case 'boss':
      return randomInt(30, 40);
    default:
      return randomInt(4, 8);
  }
}

/** Split totalValue across count particles; values sum exactly to totalValue. */
export function splitResidueValue(totalValue: number, count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [totalValue];

  const base = Math.floor((totalValue / count) * 1000) / 1000;
  const values = Array.from({ length: count }, () => base);
  const assigned = base * count;
  values[count - 1] = Math.round((totalValue - assigned + base) * 1000) / 1000;
  return values;
}

export function resolveResidueEnemyTier(inc: ActiveIncursionState): ResidueEnemyTier {
  const node = inc.encounterPath[Math.max(0, inc.nodesCleared - 1)]
    ?? inc.encounterPath[inc.currentEncounterIndex];
  if (node?.type === 'BOSS_COMBAT' || node?.isAnomalyNest) return 'boss';
  if (node?.type === 'ELITE_COMBAT' || node?.sectorMeta?.combatTier === 'ELITE') return 'elite';
  return 'standard';
}

/**
 * Generates a swarm of ghostly residue particles for one loot drop.
 * Particles scatter randomly across the harvest floor (may overlap resources).
 */
export function spawnResidueSwarm(
  enemyType: ResidueEnemyTier,
  _depth: number,
  floor: HarvestFloorBounds,
  options?: {
    instanceId?: string;
    totalValue?: number;
  },
): ResidueParticleData[] {
  const count = particleCountForTier(enemyType);
  const totalValue = options?.totalValue ?? 1;
  const values = splitResidueValue(totalValue, count);
  const instanceId = options?.instanceId ?? nextParticleId();

  return values.map((value) => ({
    id: nextParticleId(),
    instanceId,
    startX: randomInRange(floor.xMin, floor.xMax),
    startY: randomInRange(floor.yMin, floor.yMax),
    value,
    size: randomInt(8, 12),
    vacuumDelayMs: Math.random() * 300,
  }));
}

export function harvestFloorFromWindowRect(
  rect: { x: number; y: number; width: number; height: number },
  overlayOrigin: { x: number; y: number },
): HarvestFloorBounds {
  return {
    xMin: rect.x - overlayOrigin.x,
    xMax: rect.x + rect.width - overlayOrigin.x,
    yMin: rect.y - overlayOrigin.y,
    yMax: rect.y + rect.height - overlayOrigin.y,
  };
}
