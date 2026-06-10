import type { IncursionBiome, IncursionNode } from '../types/game';
import type { EnvironmentType } from '../types/sector';
import type { MacroBiomeFamily, SubBiomeId } from '../types/narrativeProcedural';
import type { DistrictId } from './districtPacing';
import { getDistrictFromDepth, depthFromNodesCleared } from './districtPacing';

export type { SubBiomeId };

const ROTATING_FAMILIES: readonly MacroBiomeFamily[] = [
  'CITY_STREETS',
  'CITY_BUILDINGS',
  'FORESTS',
  'UNDERGROUND',
  'BACKROADS',
];

const SUB_BIOMES_BY_FAMILY: Record<MacroBiomeFamily, readonly SubBiomeId[]> = {
  CITY_STREETS: ['ALLEYS', 'PARKS', 'GRAVEYARD'],
  CITY_BUILDINGS: ['SCHOOL', 'THEATRE', 'HOSPITAL', 'CHURCH'],
  FORESTS: ['CABIN', 'LAKE', 'FOREST'],
  UNDERGROUND: ['SEWERS', 'UNDERGROUND_CITY', 'TRANSIT_LINES'],
  BACKROADS: ['HOTEL', 'PIT_STOP', 'FARM'],
  DEEP_VEIL: ['VOID_RIFT', 'NULL_CHASM', 'PRIMEVAL_BREACH'],
};

export const MACRO_BIOME_DISPLAY: Record<MacroBiomeFamily, string> = {
  CITY_STREETS: 'City Streets',
  CITY_BUILDINGS: 'City Buildings',
  FORESTS: 'Forests',
  UNDERGROUND: 'Underground',
  BACKROADS: 'Backroads',
  DEEP_VEIL: 'Deep Veil',
};

export const SUB_BIOME_DISPLAY: Record<SubBiomeId, string> = {
  ALLEYS: 'Alleys',
  PARKS: 'Parks',
  GRAVEYARD: 'Graveyard',
  SCHOOL: 'School',
  THEATRE: 'Theatre',
  HOSPITAL: 'Hospital',
  CHURCH: 'Church',
  CABIN: 'Cabin',
  LAKE: 'Lake',
  FOREST: 'Forest',
  SEWERS: 'Sewers',
  UNDERGROUND_CITY: 'Underground City',
  TRANSIT_LINES: 'Transit Lines',
  HOTEL: 'Hotel',
  PIT_STOP: 'Pit Stop',
  FARM: 'Farm',
  VOID_RIFT: 'Void Rift',
  NULL_CHASM: 'Null Chasm',
  PRIMEVAL_BREACH: 'Primeval Breach',
};

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function macroFamilyForDistrict(district: DistrictId): MacroBiomeFamily {
  return district === 3 ? 'DEEP_VEIL' : ROTATING_FAMILIES[0];
}

/** Roll next macro family — district 3 always DEEP_VEIL; districts 1–2 never repeat twice in a row. */
export function rollNextMacroBiomeFamily(
  district: DistrictId,
  lastFamily: MacroBiomeFamily | null,
  seed: string,
): MacroBiomeFamily {
  if (district === 3) return 'DEEP_VEIL';

  const pool = ROTATING_FAMILIES.filter((family) => family !== lastFamily);
  const index = hashSeed(seed) % pool.length;
  return pool[index] ?? pool[0];
}

export function rollSubBiome(family: MacroBiomeFamily, seed: string): SubBiomeId {
  const pool = SUB_BIOMES_BY_FAMILY[family];
  const index = hashSeed(`${seed}:sub`) % pool.length;
  return pool[index] ?? pool[0];
}

export function rollMacroBiomeStep(
  nodesCleared: number,
  lastFamily: MacroBiomeFamily | null,
  seed: string,
): { family: MacroBiomeFamily; subBiome: SubBiomeId } {
  const depth = depthFromNodesCleared(nodesCleared);
  const district = getDistrictFromDepth(depth);
  const family = rollNextMacroBiomeFamily(district, lastFamily, seed);
  const subBiome = rollSubBiome(family, seed);
  return { family, subBiome };
}

export function subBiomeToIncursionBiome(subBiome: SubBiomeId): IncursionBiome {
  switch (subBiome) {
    case 'HOSPITAL':
      return 'HOSPITAL';
    case 'SCHOOL':
    case 'THEATRE':
    case 'CHURCH':
    case 'HOTEL':
      return 'LABORATORY';
    case 'VOID_RIFT':
    case 'NULL_CHASM':
    case 'PRIMEVAL_BREACH':
      return 'SECTOR_CORE';
    default:
      return 'CITY_STREETS';
  }
}

export function subBiomeToEnvironmentType(subBiome: SubBiomeId, graphDepth = 1): EnvironmentType {
  const transitLike = new Set<SubBiomeId>(['ALLEYS', 'SEWERS', 'TRANSIT_LINES', 'PIT_STOP']);
  const highRiseLike = new Set<SubBiomeId>([
    'SCHOOL', 'THEATRE', 'HOSPITAL', 'HOTEL', 'CABIN', 'UNDERGROUND_CITY',
  ]);
  const sanctuaryLike = new Set<SubBiomeId>([
    'PARKS', 'GRAVEYARD', 'CHURCH', 'LAKE', 'FOREST', 'FARM',
    'VOID_RIFT', 'NULL_CHASM', 'PRIMEVAL_BREACH',
  ]);

  if (transitLike.has(subBiome)) return 'SUBWAY_CHASM';
  if (highRiseLike.has(subBiome)) return 'BLEEDING_HIGH_RISE';
  if (sanctuaryLike.has(subBiome)) return 'DESECRATED_SANCTUARY';

  if (graphDepth <= 6) return 'SUBWAY_CHASM';
  if (graphDepth <= 12) return 'BLEEDING_HIGH_RISE';
  return 'DESECRATED_SANCTUARY';
}

export function formatMacroBiomeLogLine(family: MacroBiomeFamily, subBiome: SubBiomeId): string {
  return `>> MACRO BIOME — ${MACRO_BIOME_DISPLAY[family].toUpperCase()} // ${SUB_BIOME_DISPLAY[subBiome].toUpperCase()}`;
}

export function applyMacroBiomeToIncursionNode(
  node: IncursionNode,
  family: MacroBiomeFamily,
  subBiome: SubBiomeId,
): IncursionNode {
  const graphDepth = node.sectorMeta
    ? Math.max(1, node.encounterIndex + 1)
    : 1;
  return {
    ...node,
    biome: subBiomeToIncursionBiome(subBiome),
    environmentType: subBiomeToEnvironmentType(subBiome, graphDepth),
    label: node.isExtractionNode || node.isAnomalyNest
      ? node.label
      : `${SUB_BIOME_DISPLAY[subBiome].toUpperCase()} // ${node.label}`,
  };
}

export function applyMacroBiomeToCluster(
  cluster: IncursionNode[],
  family: MacroBiomeFamily,
  subBiome: SubBiomeId,
): IncursionNode[] {
  return cluster.map((node) => applyMacroBiomeToIncursionNode(node, family, subBiome));
}
