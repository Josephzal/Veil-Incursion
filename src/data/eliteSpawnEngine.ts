import type { DistrictId } from './districtPacing';
import type { EncounterOrigin } from '../types/encounterSpawn';
import {
  filterSquadsByEncounterOrigin,
  SQUAD_PICK_ATTEMPTS,
} from './encounterSquadOrigin';
import { DEPTH_3_EXCLUSIVE_ENEMIES } from './synergyDatabase';
import type { SynergyBiome, SynergySquadSpec } from './synergyEncounterTypes';
import { ELITE_DATABASE, verifyEliteDecks } from './eliteDatabase';
import { rosterIsAllAlpha } from './rosterSpawnSlots';
import { squadAllowedAtDepth } from './encounterSpawnGateEngine';

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
    const unitKeys = squad.roster.map((u) => u.type);
    if (!squadAllowedAtDepth(unitKeys, currentDepth)) return false;
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

  const candidates = lastEncounterId != null
    ? pool.filter((squad) => squad.id !== lastEncounterId)
    : pool;
  const pickPool = candidates.length > 0 ? candidates : pool;
  const idx = Math.floor(rand() * pickPool.length);
  return pickPool[idx] ?? null;
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

export { verifyEliteDecks } from './eliteDatabase';

/** @deprecated Use verifyEliteDecks */
export function verifyEliteDatabase(): void {
  verifyEliteDecks();
}
