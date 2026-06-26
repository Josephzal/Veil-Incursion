import type { DistrictId } from './districtPacing';
import type { EncounterOrigin } from './originDeckEngine';
import {
  filterSquadsByEncounterOrigin,
  SQUAD_PICK_ATTEMPTS,
} from './encounterSquadOrigin';
import { DEPTH_3_EXCLUSIVE_ENEMIES } from './synergyDatabase';
import type { SynergyBiome, SynergySquadSpec } from './synergyEncounterTypes';
import { ELITE_DATABASE } from './eliteDatabase';
import { rosterIsAllAlpha } from './rosterSpawnSlots';

const D3_BIOMES: readonly SynergyBiome[] = ['DEEP_VEIL', 'FRACTAL_ABYSS', 'SANGUINE_ATRIUM'];

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

export function filterEliteDepthPool(currentDepth: DistrictId): SynergySquadSpec[] {
  return ELITE_DATABASE.filter((squad) => {
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

function tryPickSquad(
  depthPool: SynergySquadSpec[],
  currentBiome: SynergyBiome,
  rand: () => number,
  lastEncounterId: string | null,
  interloper: boolean | undefined,
): SynergySquadSpec | null {
  const biomePool = filterBiomePool(depthPool, currentBiome);
  const primaryPool = biomePool.length > 0 ? biomePool : depthPool;
  const useInterloper = interloper ?? rand() > 0.8;
  const candidatePool = useInterloper ? depthPool : primaryPool;
  return pickFromPool(candidatePool, rand, lastEncounterId);
}

export interface LoadEliteEncounterOptions {
  lastEncounterId?: string | null;
  interloper?: boolean;
  encounterOrigin?: EncounterOrigin | null;
}

function loadFromPool(
  pool: readonly SynergySquadSpec[],
  currentDepth: DistrictId,
  currentBiome: SynergyBiome,
  rand: () => number,
  options: LoadEliteEncounterOptions,
): SynergySquadSpec | null {
  const depthPool = pool.filter((squad) => {
    if (!squad.allowedDepths.includes(currentDepth)) return false;
    if (currentDepth < 3 && squadUsesDepth3ExclusiveEnemy(squad)) return false;
    return validateAmalgamPlacement(squad);
  });
  if (depthPool.length === 0) return null;

  const lastEncounterId = options.lastEncounterId ?? null;
  const forcedInterloper = options.interloper;

  for (const attempt of SQUAD_PICK_ATTEMPTS) {
    const originFiltered = attempt.filterOrigin
      ? filterSquadsByEncounterOrigin(depthPool, options.encounterOrigin)
      : depthPool;
    if (originFiltered.length === 0) continue;

    const squad = tryPickSquad(
      originFiltered,
      currentBiome,
      rand,
      lastEncounterId,
      forcedInterloper ?? attempt.interloper,
    );
    if (squad) return squad;
  }

  return null;
}

/** Curated elite squads — supports commander mixes with per-unit alpha. */
export function loadEliteEncounter(
  currentDepth: DistrictId,
  currentBiome: SynergyBiome,
  rand: () => number,
  options: LoadEliteEncounterOptions = {},
): SynergySquadSpec | null {
  return loadFromPool(ELITE_DATABASE, currentDepth, currentBiome, rand, options);
}

/** Alpha-duel milestone — solo/duo elites only (every unit is alpha). */
export function loadAlphaDuelElite(
  currentDepth: DistrictId,
  currentBiome: SynergyBiome,
  rand: () => number,
  options: LoadEliteEncounterOptions = {},
): SynergySquadSpec | null {
  const alphaDuelPool = ELITE_DATABASE.filter((squad) => rosterIsAllAlpha(squad.roster));
  return loadFromPool(alphaDuelPool, currentDepth, currentBiome, rand, options);
}

export function verifyEliteDatabase(): void {
  const ids = new Set<string>();
  for (const squad of ELITE_DATABASE) {
    if (ids.has(squad.id)) {
      throw new Error(`verifyEliteDatabase: duplicate squad id ${squad.id}`);
    }
    ids.add(squad.id);
    if (squad.roster.length === 0) {
      throw new Error(`verifyEliteDatabase: empty roster for ${squad.id}`);
    }
    if (!validateAmalgamPlacement(squad)) {
      throw new Error(`verifyEliteDatabase: invalid AMALGAM placement for ${squad.id}`);
    }
    for (const depth of squad.allowedDepths) {
      if (depth < 3 && squadUsesDepth3ExclusiveEnemy(squad)) {
        throw new Error(`verifyEliteDatabase: depth-3 exclusive enemy in ${squad.id} at depth ${depth}`);
      }
      for (const biome of squad.allowedBiomes) {
        if (depth < 3 && (D3_BIOMES as readonly string[]).includes(biome)) {
          throw new Error(`verifyEliteDatabase: D3 biome ${biome} on ${squad.id} at depth ${depth}`);
        }
      }
    }
  }

  for (const depth of [1, 2, 3] as const) {
    for (const biome of depth === 3
      ? D3_BIOMES
      : (['CITY_STREETS', 'CITY_BUILDINGS', 'BACKROADS', 'BLACK_SITE_SECTOR', 'UNDERGROUND', 'FORESTS'] as const)) {
      const pool = filterBiomePool(filterEliteDepthPool(depth), biome);
      if (pool.length === 0) {
        throw new Error(`verifyEliteDatabase: no elites for depth ${depth} biome ${biome}`);
      }
      const alphaDuelPool = filterBiomePool(
        filterEliteDepthPool(depth).filter((squad) => rosterIsAllAlpha(squad.roster)),
        biome,
      );
      if (alphaDuelPool.length === 0) {
        throw new Error(`verifyEliteDatabase: no alpha-duel elites for depth ${depth} biome ${biome}`);
      }
    }
  }
}
