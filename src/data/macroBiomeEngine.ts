import type { IncursionNode } from '../types/game';
import type { VeilBiome } from '../types/encounterSpawn';
import type { MacroBiomeFamily } from '../types/narrativeProcedural';
import { veilBiomeToLegacyMacroBiome } from './sectorBiomeBridge';

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

export function getMacroBiomeDisplayLabel(family: MacroBiomeFamily | null | undefined): string {
  if (!family) return 'UNKNOWN';
  return MACRO_BIOME_DISPLAY[family];
}

export function formatMacroBiomeLogLine(family: MacroBiomeFamily): string {
  return `>> MACRO BIOME — ${MACRO_BIOME_DISPLAY[family].toUpperCase()}`;
}

export function getMacroBiomeContextLog(family: MacroBiomeFamily): string {
  return `BIOME ANCHOR // ${MACRO_BIOME_DISPLAY[family].toUpperCase()} SECTOR`;
}

/** Resolve scanner/combat display — run Veil biome wins, then legacy node offer, then district lock. */
export function resolveDisplayedMacroBiome(
  node: IncursionNode | null | undefined,
  lockedBiome: MacroBiomeFamily | null | undefined,
  runVeilBiome?: VeilBiome | null,
): MacroBiomeFamily | null {
  if (runVeilBiome) {
    return veilBiomeToLegacyMacroBiome(runVeilBiome);
  }
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
