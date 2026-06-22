import type { IncursionNode } from '../types/game';
import type { MacroBiomeFamily } from '../types/narrativeProcedural';
import type { DistrictId } from './districtPacing';
import { LEVELS_PER_DISTRICT } from '../types/sectorPacing';
import { getDistrictFromDepth, depthFromNodesCleared } from './districtPacing';

/** Districts 1–2 — six early-game biomes (equal weight within pool). */
export const DEPTH_1_2_BIOME_POOL: readonly MacroBiomeFamily[] = [
  'CITY_STREETS',
  'CITY_BUILDINGS',
  'BACKROADS',
  'FORESTS',
  'SUNKEN_TRANSIT',
  'BLACK_SITE_SECTOR',
];

/** District 3 — three endgame biomes. */
export const DEPTH_3_BIOME_POOL: readonly MacroBiomeFamily[] = [
  'DEEP_VEIL',
  'SANGUINE_ATRIUM',
  'FRACTAL_ABYSS',
];

export const MACRO_BIOME_DISPLAY: Record<MacroBiomeFamily, string> = {
  CITY_STREETS: 'City Streets',
  CITY_BUILDINGS: 'City Buildings',
  FORESTS: 'Forests',
  UNDERGROUND: 'Underground',
  BACKROADS: 'Backroads',
  SUNKEN_TRANSIT: 'Sunken Transit',
  BLACK_SITE_SECTOR: 'Black-Site Sector',
  DEEP_VEIL: 'Deep Veil',
  FRACTAL_ABYSS: 'Fractal Abyss',
  SANGUINE_ATRIUM: 'Sanguine Atrium',
};

function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function biomePoolForDistrict(district: DistrictId): readonly MacroBiomeFamily[] {
  return district === 3 ? DEPTH_3_BIOME_POOL : DEPTH_1_2_BIOME_POOL;
}

/** First scanner hub of each district — player picks biome via combat vector. */
export function isDistrictEntryScannerHub(nodesCleared: number): boolean {
  return (
    nodesCleared === 0
    || nodesCleared === LEVELS_PER_DISTRICT
    || nodesCleared === LEVELS_PER_DISTRICT * 2
  );
}

/** Roll two distinct macro biomes for district-entry combat choice. */
export function rollDistrictBiomeOptions(
  district: DistrictId,
  excluded: readonly MacroBiomeFamily[],
  seed: string,
): [MacroBiomeFamily, MacroBiomeFamily] {
  const pool = biomePoolForDistrict(district).filter((family) => !excluded.includes(family));
  if (pool.length < 2) {
    const fallback = biomePoolForDistrict(district);
    return [fallback[0], fallback[1] ?? fallback[0]];
  }

  const firstIndex = hashSeed(`${seed}:a`) % pool.length;
  let secondIndex = hashSeed(`${seed}:b`) % pool.length;
  if (secondIndex === firstIndex) {
    secondIndex = (secondIndex + 1) % pool.length;
  }

  return [pool[firstIndex], pool[secondIndex]];
}

export function getMacroBiomeDisplayLabel(family: MacroBiomeFamily | null | undefined): string {
  if (!family) return 'UNKNOWN';
  return MACRO_BIOME_DISPLAY[family];
}

export function formatMacroBiomeLogLine(family: MacroBiomeFamily): string {
  return `>> MACRO BIOME — ${MACRO_BIOME_DISPLAY[family].toUpperCase()}`;
}

export function formatDistrictBiomeSelectionLog(
  offers: readonly [MacroBiomeFamily, MacroBiomeFamily],
): string {
  const labels = offers.map((family) => MACRO_BIOME_DISPLAY[family].toUpperCase());
  return `>> MACRO BIOME SELECTION — ${labels.join(' // ')}`;
}

export function getMacroBiomeContextLog(family: MacroBiomeFamily): string {
  return `BIOME ANCHOR // ${MACRO_BIOME_DISPLAY[family].toUpperCase()} SECTOR`;
}

/** Resolve scanner/combat display — node offer wins while district biome is unlocked. */
export function resolveDisplayedMacroBiome(
  node: IncursionNode | null | undefined,
  lockedBiome: MacroBiomeFamily | null | undefined,
): MacroBiomeFamily | null {
  if (node?.offeredMacroBiome) return node.offeredMacroBiome;
  return lockedBiome ?? null;
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

/** @deprecated Per-node rotation removed — use rollDistrictBiomeOptions at district entry. */
export function rollMacroBiomeStep(
  nodesCleared: number,
  _lastFamily: MacroBiomeFamily | null,
  _seed: string,
): MacroBiomeFamily {
  const district = getDistrictFromDepth(depthFromNodesCleared(nodesCleared));
  const [a] = rollDistrictBiomeOptions(district, [], `legacy:${nodesCleared}`);
  return a;
}
