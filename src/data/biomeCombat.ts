import { IncursionBiome } from '../types/game';
import type { SectorBlockSpec } from '../types/macroStory';

/** Authoritative 10-step sector-block layout (indices 0–9). */
export const SECTOR_BLOCK_LAYOUT: readonly SectorBlockSpec[] = [
  { depthStart: 0, depthEnd: 2, biome: 'CITY_STREETS', label: 'Streets' },
  { depthStart: 3, depthEnd: 5, biome: 'HOSPITAL', label: 'Hospital' },
  { depthStart: 6, depthEnd: 7, biome: 'LABORATORY', label: 'Lab' },
  { depthStart: 8, depthEnd: 9, biome: 'SECTOR_CORE', label: 'Core' },
] as const;

export const SECTOR_CORE_DEPTH_INDICES = [8, 9] as const;

export const BIOME_COMBAT_DESIGNATIONS: Record<IncursionBiome, readonly string[]> = {
  CITY_STREETS: ['Static Remnant', 'Asphalt Stalker', 'Transit Wraith'],
  HOSPITAL: ['ICU Specter', 'Marrow Collector', 'Phantom Triage'],
  LABORATORY: ['Hazmat Entity', 'Centrifuge Aberration', 'Data-Weave Singularity'],
  SECTOR_CORE: ['Veil Inquisitor', 'Anomalous Archon', 'The Manifested Core'],
};

export function pickBiomeCombatDesignation(biome: IncursionBiome, isBoss: boolean): string {
  const pool = BIOME_COMBAT_DESIGNATIONS[biome];
  if (isBoss && biome === 'SECTOR_CORE') return 'The Manifested Core';
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Strict sector-block biome by depth index (0–9) — mirrors SECTOR_BLOCK_LAYOUT. */
export function biomeForDepthIndex(depthIndex: number): IncursionBiome {
  const block = SECTOR_BLOCK_LAYOUT.find(
    (b) => depthIndex >= b.depthStart && depthIndex <= b.depthEnd,
  );
  return block?.biome ?? 'SECTOR_CORE';
}

/** Combat spawns must use the node's localized biome tag — no cross-sector units. */
export function assertBiomeCombatContext(
  depthIndex: number,
  biome: IncursionBiome,
): void {
  if (biomeForDepthIndex(depthIndex) !== biome) {
    throw new Error(
      `Biome lock violation at depth ${depthIndex}: expected ${biomeForDepthIndex(depthIndex)}, got ${biome}`,
    );
  }
}
