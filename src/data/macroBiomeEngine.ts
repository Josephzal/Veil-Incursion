import type { IncursionNode } from '../types/game';
import type { MacroBiomeFamily } from '../types/narrativeProcedural';
import type { DistrictId } from './districtPacing';
import { getDistrictFromDepth, depthFromNodesCleared } from './districtPacing';

const ROTATING_FAMILIES: readonly MacroBiomeFamily[] = [
  'CITY_STREETS',
  'CITY_BUILDINGS',
  'FORESTS',
  'UNDERGROUND',
  'BACKROADS',
];

export const MACRO_BIOME_DISPLAY: Record<MacroBiomeFamily, string> = {
  CITY_STREETS: 'City Streets',
  CITY_BUILDINGS: 'City Buildings',
  FORESTS: 'Forests',
  UNDERGROUND: 'Underground',
  BACKROADS: 'Backroads',
  DEEP_VEIL: 'Deep Veil',
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

export function rollMacroBiomeStep(
  nodesCleared: number,
  lastFamily: MacroBiomeFamily | null,
  seed: string,
): MacroBiomeFamily {
  const depth = depthFromNodesCleared(nodesCleared);
  const district = getDistrictFromDepth(depth);
  return rollNextMacroBiomeFamily(district, lastFamily, seed);
}

export function formatMacroBiomeLogLine(family: MacroBiomeFamily): string {
  return `>> MACRO BIOME — ${MACRO_BIOME_DISPLAY[family].toUpperCase()}`;
}

export function getMacroBiomeContextLog(family: MacroBiomeFamily): string {
  return `BIOME ANCHOR // ${MACRO_BIOME_DISPLAY[family].toUpperCase()} SECTOR`;
}

export function applyMacroBiomeToIncursionNode(
  node: IncursionNode,
  family: MacroBiomeFamily,
): IncursionNode {
  return {
    ...node,
    label: node.isExtractionNode || node.isAnomalyNest
      ? node.label
      : `${MACRO_BIOME_DISPLAY[family].toUpperCase()} // ${node.label}`,
  };
}

export function applyMacroBiomeToCluster(
  cluster: IncursionNode[],
  family: MacroBiomeFamily,
): IncursionNode[] {
  return cluster.map((node) => applyMacroBiomeToIncursionNode(node, family));
}
