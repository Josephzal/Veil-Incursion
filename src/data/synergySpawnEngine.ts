import type { MacroBiomeFamily } from '../types/narrativeProcedural';
import type { DistrictId } from './districtPacing';
import type { EncounterOrigin } from '../types/encounterSpawn';
import type { EncounterEnemyKey } from './enemyCombatConfig';
import {
  filterSquadsByEncounterOrigin,
} from './encounterSquadOrigin';
import {
  DEPTH_3_EXCLUSIVE_ENEMIES,
  SYNERGY_DATABASE,
} from './synergyDatabase';
import type { SynergyBiome, SynergySquadSpec } from './synergyEncounterTypes';
import {
  enemyAllowedAtDepth,
  squadAllowedAtDepth,
  squadUnitKeysPassSpawnGates,
  type SpawnGateContext,
} from './encounterSpawnGateEngine';
import type { VeilBiome } from '../types/encounterSpawn';
import { ALL_VEIL_BIOMES } from './sectorBiomeBridge';

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

function squadPassesDefinitionDepthGates(squad: SynergySquadSpec, depth: DistrictId): boolean {
  const unitKeys = squad.roster.map((u) => u.type);
  if (!squadAllowedAtDepth(unitKeys, depth)) return false;
  for (const unit of squad.roster) {
    if (!enemyAllowedAtDepth(unit.type, depth)) return false;
  }
  return true;
}

export function filterSquadsBySpawnGates(
  squads: SynergySquadSpec[],
  ctx: SpawnGateContext,
): SynergySquadSpec[] {
  return squads.filter((squad) => {
    const unitKeys = squad.roster.map((u) => u.type);
    return squadUnitKeysPassSpawnGates(unitKeys, ctx);
  });
}

function validateAmalgamPlacement(squad: SynergySquadSpec): boolean {
  const hasAmalgam = squad.roster.some((u) => u.type === 'AMALGAM');
  if (!hasAmalgam) return true;
  const frontOccupiers = squad.roster.filter(
    (u) => u.type !== 'AMALGAM' && (u.pos === 'FRONT_LEFT' || u.pos === 'FRONT_RIGHT' || u.pos === 'FRONT_CENTER'),
  );
  return frontOccupiers.length === 0;
}

export function filterSynergyDepthPool(currentDepth: DistrictId): SynergySquadSpec[] {
  return SYNERGY_DATABASE.filter((squad) => {
    if (!squad.allowedDepths.includes(currentDepth)) return false;
    if (currentDepth < 3 && squadUsesDepth3ExclusiveEnemy(squad)) return false;
    if (!squadPassesDefinitionDepthGates(squad, currentDepth)) return false;
    return validateAmalgamPlacement(squad);
  });
}

/** Map legacy synergy biome to Veil Front biome for spawn-gate checks. */
export function synergyBiomeToVeilBiome(biome: SynergyBiome): VeilBiome | undefined {
  switch (biome) {
    case 'CITY_STREETS':
    case 'BLACK_SITE_SECTOR':
      return 'NULL_ZONE';
    case 'CITY_BUILDINGS':
      return 'BLACKLINE_TERMINUS';
    case 'FORESTS':
    case 'SANGUINE_ATRIUM':
      return 'ABYSSAL_SINK';
    case 'BACKROADS':
      return 'ASHEN_WASTE';
    case 'UNDERGROUND':
      return 'SLAG_WORKS';
    case 'DEEP_VEIL':
    case 'FRACTAL_ABYSS':
      return 'BLACKLINE_TERMINUS';
    default:
      return undefined;
  }
}

function filterVeilBiomePool(
  depthPool: SynergySquadSpec[],
  veilBiome: VeilBiome,
): SynergySquadSpec[] {
  const locked = depthPool.filter(
    (squad) => squad.veilBiome === veilBiome || squad.veilBiome == null,
  );
  return locked.length > 0 ? locked : depthPool;
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
      if (!squadPassesDefinitionDepthGates(squad, depth)) {
        throw new Error(`verifySynergyDatabase: spawn gate depth violation in ${squad.id} at depth ${depth}`);
      }
    }
  }

  const origins: EncounterOrigin[] = ['RIVAL_MERC', 'VEIL'];

  for (const depth of [1, 2, 3] as const) {
    for (const veilBiome of ALL_VEIL_BIOMES) {
      const pool = filterVeilBiomePool(filterSynergyDepthPool(depth), veilBiome);
      if (pool.length === 0) {
        throw new Error(`verifySynergyDatabase: no squads for depth ${depth} veilBiome ${veilBiome}`);
      }
    }
    for (const origin of origins) {
      const depthOriginPool = filterSquadsByEncounterOrigin(filterSynergyDepthPool(depth), origin);
      if (depthOriginPool.length === 0) {
        throw new Error(`verifySynergyDatabase: no ${origin} squads for depth ${depth}`);
      }
    }
  }
}

export const ALL_SYNERGY_ENEMY_KEYS: EncounterEnemyKey[] = [
  ...new Set(SYNERGY_DATABASE.flatMap((s) => s.roster.map((u) => u.type))),
];
