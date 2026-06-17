import type { MacroBiomeFamily } from '../types/narrativeProcedural';

/** Canonical biome ids for atmospheric particle routing. */
export type BiomeId =
  | 'city_streets'
  | 'backroads'
  | 'deep_veil'
  | 'city_buildings'
  | 'forest';

export type ParticleEffectType = 'rain' | 'none';

export interface BiomeAtmosphereConfig {
  effect: ParticleEffectType;
}

export const BIOME_CONFIG: Record<BiomeId, BiomeAtmosphereConfig> = {
  city_streets: { effect: 'rain' },
  backroads: { effect: 'rain' },
  deep_veil: { effect: 'none' },
  city_buildings: { effect: 'none' },
  forest: { effect: 'rain' },
};

const BIOME_ID_SET = new Set<string>(Object.keys(BIOME_CONFIG));

/** Normalize legacy/alternate biome keys to canonical BiomeId values. */
export function normalizeBiomeId(input: string): BiomeId | null {
  const key = input.trim().toLowerCase();
  if (key === 'forests') return 'forest';
  if (BIOME_ID_SET.has(key)) return key as BiomeId;
  return null;
}

export function resolveParticleEffect(
  biomeId: BiomeId | string | null | undefined,
): ParticleEffectType {
  if (!biomeId) return 'none';
  const normalized = typeof biomeId === 'string' ? normalizeBiomeId(biomeId) : biomeId;
  if (!normalized) return 'none';
  return BIOME_CONFIG[normalized]?.effect ?? 'none';
}

export function macroFamilyToBiomeId(
  family: MacroBiomeFamily | null | undefined,
): BiomeId | null {
  switch (family) {
    case 'CITY_STREETS':
      return 'city_streets';
    case 'CITY_BUILDINGS':
      return 'city_buildings';
    case 'FORESTS':
      return 'forest';
    case 'BACKROADS':
      return 'backroads';
    case 'DEEP_VEIL':
      return 'deep_veil';
    default:
      return null;
  }
}
