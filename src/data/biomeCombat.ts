import { IncursionBiome } from '../types/game';
import type { SectorBlockSpec } from '../types/macroStory';

/** Authoritative 10-step sector-block layout (indices 0–9). */
export const SECTOR_BLOCK_LAYOUT: readonly SectorBlockSpec[] = [
  { encounterStart: 0, encounterEnd: 9, biome: 'CITY_STREETS', label: 'Streets' },
] as const;

export const SECTOR_CORE_ENCOUNTER_INDICES = [8, 9] as const;

export const BIOME_COMBAT_DESIGNATIONS: Record<IncursionBiome, readonly string[]> = {
  CITY_STREETS: ['Static Remnant', 'Asphalt Stalker', 'Transit Wraith'],
  HOSPITAL: ['ICU Specter', 'Marrow Collector', 'Phantom Triage'],
  LABORATORY: ['Hazmat Entity', 'Centrifuge Aberration', 'Data-Weave Singularity'],
  SECTOR_CORE: ['Veil Inquisitor', 'Anomalous Archon', 'The Manifested Core'],
};

export function pickBiomeCombatDesignation(biome: IncursionBiome, isBoss: boolean): string {
  const pool = BIOME_COMBAT_DESIGNATIONS[biome];
  if (isBoss && biome === 'SECTOR_CORE') return 'The Manifested Core';
  if (isBoss && biome === 'CITY_STREETS') return 'Gridlock Colossus';
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Strict sector-block biome by encounter index (0–9) — mirrors SECTOR_BLOCK_LAYOUT. */
export function biomeForEncounterIndex(encounterIndex: number): IncursionBiome {
  const block = SECTOR_BLOCK_LAYOUT.find(
    (b) => encounterIndex >= b.encounterStart && encounterIndex <= b.encounterEnd,
  );
  return block?.biome ?? 'CITY_STREETS';
}

/** Combat spawns must use the node's localized biome tag — no cross-sector units. */
export function assertBiomeCombatContext(
  encounterIndex: number,
  biome: IncursionBiome,
): void {
  if (biomeForEncounterIndex(encounterIndex) !== biome) {
    throw new Error(
      `Biome lock violation at encounter ${encounterIndex}: expected ${biomeForEncounterIndex(encounterIndex)}, got ${biome}`,
    );
  }
}
