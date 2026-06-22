import type { MacroBiomeFamily } from '../types/narrativeProcedural';
import type { DistrictId } from './districtPacing';
import type { EncounterEnemyKey } from './enemyCombatConfig';
import {
  DEPTH_3_EXCLUSIVE_ENEMIES,
  SYNERGY_DATABASE,
} from './synergyDatabase';
import type { SynergyBiome, SynergySquadSpec } from './synergyEncounterTypes';

/** Sunken Transit shares the Underground synergy pool. */
export function macroFamilyToSynergyBiome(
  family: MacroBiomeFamily | null | undefined,
): SynergyBiome {
  if (family == null) return 'CITY_STREETS';
  if (family === 'SUNKEN_TRANSIT') return 'UNDERGROUND';
  return family as SynergyBiome;
}

function squadUsesDepth3ExclusiveEnemy(squad: SynergySquadSpec): boolean {
  return squad.roster.some((unit) =>
    (DEPTH_3_EXCLUSIVE_ENEMIES as readonly string[]).includes(unit.type),
  );
}

function validateAmalgamPlacement(squad: SynergySquadSpec): boolean {
  const hasAmalgam = squad.roster.some((u) => u.type === 'AMALGAM');
  if (!hasAmalgam) return true;
  const frontOccupiers = squad.roster.filter(
    (u) => u.type !== 'AMALGAM' && (u.pos === 'FRONT_LEFT' || u.pos === 'FRONT_RIGHT' || u.pos === 'FRONT_CENTER'),
  );
  return frontOccupiers.length === 0;
}

function filterDepthPool(currentDepth: DistrictId): SynergySquadSpec[] {
  return SYNERGY_DATABASE.filter((squad) => {
    if (!squad.allowedDepths.includes(currentDepth)) return false;
    if (currentDepth < 3 && squadUsesDepth3ExclusiveEnemy(squad)) return false;
    return validateAmalgamPlacement(squad);
  });
}

function filterBiomePool(
  depthPool: SynergySquadSpec[],
  currentBiome: SynergyBiome,
): SynergySquadSpec[] {
  return depthPool.filter((squad) => squad.allowedBiomes.includes(currentBiome));
}

function pickFromPool(
  pool: SynergySquadSpec[],
  rand: () => number,
  lastEncounterId: string | null,
): SynergySquadSpec | null {
  if (pool.length === 0) return null;
  let attempts = 0;
  while (attempts < 8) {
    const idx = Math.floor(rand() * pool.length);
    const pick = pool[idx];
    if (!pick) break;
    if (pick.id !== lastEncounterId || pool.length === 1) return pick;
    attempts += 1;
  }
  return pool[0] ?? null;
}

export interface LoadCombatEncounterOptions {
  lastEncounterId?: string | null;
  /** When true, skip biome filter (interloper ambush). */
  interloper?: boolean;
}

/**
 * Picks a synergy squad for the current district + macro biome.
 * 80% thematic (depth + biome), 20% interloper (depth only).
 */
export function loadCombatEncounter(
  currentDepth: DistrictId,
  currentBiome: SynergyBiome,
  rand: () => number,
  options: LoadCombatEncounterOptions = {},
): SynergySquadSpec | null {
  const depthPool = filterDepthPool(currentDepth);
  if (depthPool.length === 0) {
    return null;
  }

  const biomePool = filterBiomePool(depthPool, currentBiome);
  const primaryPool = biomePool.length > 0 ? biomePool : depthPool;

  const useInterloper = options.interloper ?? rand() > 0.8;
  const candidatePool = useInterloper ? depthPool : primaryPool;

  return pickFromPool(candidatePool, rand, options.lastEncounterId ?? null);
}

/** Dev-only catalog integrity check. */
export function verifySynergyDatabase(): void {
  const ids = new Set<string>();
  for (const squad of SYNERGY_DATABASE) {
    if (ids.has(squad.id)) {
      throw new Error(`verifySynergyDatabase: duplicate squad id ${squad.id}`);
    }
    ids.add(squad.id);
    if (squad.roster.length === 0) {
      throw new Error(`verifySynergyDatabase: empty roster for ${squad.id}`);
    }
    if (!validateAmalgamPlacement(squad)) {
      throw new Error(`verifySynergyDatabase: invalid AMALGAM placement for ${squad.id}`);
    }
    for (const depth of squad.allowedDepths) {
      if (depth < 3 && squadUsesDepth3ExclusiveEnemy(squad)) {
        throw new Error(`verifySynergyDatabase: depth-3 exclusive enemy in ${squad.id} at depth ${depth}`);
      }
    }
  }

  for (const depth of [1, 2, 3] as const) {
    for (const biome of depth === 3
      ? (['DEEP_VEIL', 'FRACTAL_ABYSS', 'SANGUINE_ATRIUM'] as const)
      : (['CITY_STREETS', 'CITY_BUILDINGS', 'BACKROADS', 'BLACK_SITE_SECTOR', 'UNDERGROUND', 'FORESTS'] as const)) {
      const pool = filterBiomePool(filterDepthPool(depth), biome);
      if (pool.length === 0) {
        throw new Error(`verifySynergyDatabase: no squads for depth ${depth} biome ${biome}`);
      }
    }
  }
}

export const ALL_SYNERGY_ENEMY_KEYS: EncounterEnemyKey[] = [
  ...new Set(SYNERGY_DATABASE.flatMap((s) => s.roster.map((u) => u.type))),
];
