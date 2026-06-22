import type { ImageSourcePropType } from 'react-native';
import BackroadsBg from '../../assets/images/environment images/backroads.png';
import CityBuildingBg from '../../assets/images/environment images/city_building.png';
import ForestBg from '../../assets/images/environment images/forest.png';
import OverworldBg from '../../assets/images/environment images/overworld.png';
import { normalizeBiomeId, type BiomeId } from './biomeConfig';

/** Per-biome arena scrim — tune independently. */
export const COMBAT_ARENA_BACKROADS_SCRIM = 'rgba(0, 0, 0, 0.68)';
export const COMBAT_ARENA_CITY_BUILDINGS_SCRIM = 'rgba(0, 0, 0, 0.8)';
export const COMBAT_ARENA_FOREST_SCRIM = 'rgba(0, 0, 0, 0.68)';
export const COMBAT_ARENA_CITY_STREETS_SCRIM = 'rgba(0, 0, 0, 0.54)';
export const COMBAT_ARENA_UNDERGROUND_SCRIM = 'rgba(0, 0, 0, 0.54)';

const COMBAT_ARENA_BACKGROUNDS: Partial<Record<BiomeId, ImageSourcePropType>> = {
  backroads: BackroadsBg,
  city_buildings: CityBuildingBg,
  forest: ForestBg,
  city_streets: OverworldBg,
  deep_veil: OverworldBg,
  underground: OverworldBg,
  sunken_transit: OverworldBg,
  black_site_sector: CityBuildingBg,
  fractal_abyss: OverworldBg,
  sanguine_atrium: OverworldBg,
};

const COMBAT_ARENA_SCRIMS: Partial<Record<BiomeId, string>> = {
  backroads: COMBAT_ARENA_BACKROADS_SCRIM,
  city_buildings: COMBAT_ARENA_CITY_BUILDINGS_SCRIM,
  forest: COMBAT_ARENA_FOREST_SCRIM,
  city_streets: COMBAT_ARENA_CITY_STREETS_SCRIM,
  underground: COMBAT_ARENA_UNDERGROUND_SCRIM,
  sunken_transit: COMBAT_ARENA_UNDERGROUND_SCRIM,
  black_site_sector: COMBAT_ARENA_CITY_BUILDINGS_SCRIM,
  fractal_abyss: COMBAT_ARENA_UNDERGROUND_SCRIM,
  sanguine_atrium: COMBAT_ARENA_UNDERGROUND_SCRIM,
  deep_veil: COMBAT_ARENA_UNDERGROUND_SCRIM,
};

export function resolveCombatArenaBackground(
  biomeId: BiomeId | string | null | undefined,
): ImageSourcePropType {
  if (!biomeId) return OverworldBg;
  const normalized = typeof biomeId === 'string' ? normalizeBiomeId(biomeId) : biomeId;
  if (!normalized) return OverworldBg;
  return COMBAT_ARENA_BACKGROUNDS[normalized] ?? OverworldBg;
}

export function resolveCombatArenaBackgroundScrim(
  biomeId: BiomeId | string | null | undefined,
): string | null {
  if (!biomeId) return null;
  const normalized = typeof biomeId === 'string' ? normalizeBiomeId(biomeId) : biomeId;
  if (!normalized) return null;
  return COMBAT_ARENA_SCRIMS[normalized] ?? null;
}
