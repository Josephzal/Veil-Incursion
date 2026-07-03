import type { MacroBiomeFamily } from '../types/narrativeProcedural';
import type { VeilBiome } from '../types/encounterSpawn';
import type { SectorId, WorldStatePersistedState } from '../types/worldState';
import type { SynergyBiome } from './synergyEncounterTypes';

/** @deprecated Renamed in Phase 1 — migrate persisted saves. */
export const LEGACY_SECTOR_ID_THE_FRACTAL_WASTES = 'THE_FRACTAL_WASTES' as const;

const SECTOR_TO_VEIL_BIOME: Record<SectorId, VeilBiome> = {
  THE_NULL_ZONE: 'NULL_ZONE',
  THE_ABYSSAL_SINK: 'ABYSSAL_SINK',
  THE_ASHEN_WASTES: 'ASHEN_WASTE',
  THE_SLAG_WORKS: 'SLAG_WORKS',
  THE_BLACKLINE_TERMINUS: 'BLACKLINE_TERMINUS',
};

const VEIL_BIOME_DISPLAY: Record<VeilBiome, string> = {
  ABYSSAL_SINK: 'Abyssal Sink',
  NULL_ZONE: 'Null Zone',
  ASHEN_WASTE: 'Ashen Wastes',
  SLAG_WORKS: 'Slag Works',
  BLACKLINE_TERMINUS: 'Blackline Terminus',
};

/** Maps Veil biomes to synergy deck filter tags (encounter deck builder). */
const VEIL_BIOME_TO_SYNERGY: Record<VeilBiome, readonly SynergyBiome[]> = {
  NULL_ZONE: ['CITY_STREETS', 'CITY_BUILDINGS', 'BLACK_SITE_SECTOR'],
  ABYSSAL_SINK: ['FORESTS', 'SANGUINE_ATRIUM'],
  ASHEN_WASTE: ['BACKROADS'],
  SLAG_WORKS: ['UNDERGROUND'],
  BLACKLINE_TERMINUS: ['BLACK_SITE_SECTOR', 'DEEP_VEIL', 'FRACTAL_ABYSS'],
};

/** Scanner HUD macro label shim — Veil biome → legacy MacroBiomeFamily display. */
const VEIL_BIOME_TO_LEGACY_MACRO: Record<VeilBiome, MacroBiomeFamily> = {
  NULL_ZONE: 'CITY_STREETS',
  ABYSSAL_SINK: 'FORESTS',
  ASHEN_WASTE: 'BACKROADS',
  SLAG_WORKS: 'UNDERGROUND',
  BLACKLINE_TERMINUS: 'BLACK_SITE_SECTOR',
};

export const ALL_VEIL_BIOMES: readonly VeilBiome[] = [
  'ABYSSAL_SINK',
  'NULL_ZONE',
  'ASHEN_WASTE',
  'SLAG_WORKS',
  'BLACKLINE_TERMINUS',
] as const;

export const ALL_SECTOR_IDS: readonly SectorId[] = [
  'THE_SLAG_WORKS',
  'THE_ABYSSAL_SINK',
  'THE_NULL_ZONE',
  'THE_BLACKLINE_TERMINUS',
  'THE_ASHEN_WASTES',
] as const;

export function normalizeSectorId(raw: string | undefined | null): SectorId {
  if (raw === LEGACY_SECTOR_ID_THE_FRACTAL_WASTES) {
    return 'THE_ASHEN_WASTES';
  }
  if (raw && (ALL_SECTOR_IDS as readonly string[]).includes(raw)) {
    return raw as SectorId;
  }
  return 'THE_SLAG_WORKS';
}

export function sectorIdToVeilBiome(sectorId: SectorId): VeilBiome {
  return SECTOR_TO_VEIL_BIOME[sectorId];
}

export function veilBiomeToSectorId(biome: VeilBiome): SectorId {
  const entry = (Object.entries(SECTOR_TO_VEIL_BIOME) as Array<[SectorId, VeilBiome]>)
    .find(([, value]) => value === biome);
  return entry?.[0] ?? 'THE_SLAG_WORKS';
}

export function veilBiomeDisplayName(biome: VeilBiome): string {
  return VEIL_BIOME_DISPLAY[biome];
}

export function veilBiomeToSynergyBiomes(biome: VeilBiome): readonly SynergyBiome[] {
  return VEIL_BIOME_TO_SYNERGY[biome];
}

/** Until narrative seeds use VeilBiome directly. */
export function veilBiomeToLegacyMacroBiome(biome: VeilBiome): MacroBiomeFamily {
  return VEIL_BIOME_TO_LEGACY_MACRO[biome];
}

export function sectorIdToLegacyMacroBiome(sectorId: SectorId): MacroBiomeFamily {
  return veilBiomeToLegacyMacroBiome(sectorIdToVeilBiome(sectorId));
}

function migrateAnchorIdKey(key: string): string {
  return key.replace(
    /the_fractal_wastes/gi,
    'the_ashen_wastes',
  );
}

/** Migrate persisted world state after Fractal Wastes → Ashen Wastes rename. */
export function migrateWorldStateSectorKeys(
  state: WorldStatePersistedState,
): WorldStatePersistedState {
  const selectedSectorId = normalizeSectorId(state.selectedSectorId);

  const activeOperationIndex: Partial<Record<SectorId, number>> = {};
  for (const [key, value] of Object.entries(state.activeOperationIndex ?? {})) {
    activeOperationIndex[normalizeSectorId(key)] = value;
  }

  const temporarySectorModifiers = (state.temporarySectorModifiers ?? []).map((mod) => ({
    ...mod,
    sectorId: normalizeSectorId(mod.sectorId),
  }));

  const dormantAnchorRuns: Record<string, number> = {};
  for (const [key, value] of Object.entries(state.dormantAnchorRuns ?? {})) {
    dormantAnchorRuns[migrateAnchorIdKey(key)] = value;
  }

  return {
    ...state,
    selectedSectorId,
    activeOperationIndex,
    temporarySectorModifiers,
    dormantAnchorRuns,
  };
}
