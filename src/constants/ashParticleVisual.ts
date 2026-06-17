import { StyleSheet } from 'react-native';

/** Visual spec shared with the former ambient biome ash layer. */
export const BIOME_ASH_PARTICLE_SIZE = 3;
export const BIOME_ASH_PARTICLE_RADIUS = 2;
export const BIOME_ASH_PARTICLE_COLOR = 'rgba(180, 180, 180, 0.6)' as const;
export const BIOME_ASH_OPACITY_MIN = 0.35;
export const BIOME_ASH_OPACITY_RANGE = 0.35;

export function randomBiomeAshOpacity(): number {
  return BIOME_ASH_OPACITY_MIN + Math.random() * BIOME_ASH_OPACITY_RANGE;
}

export const biomeAshParticleStyle = StyleSheet.create({
  particle: {
    width: BIOME_ASH_PARTICLE_SIZE,
    height: BIOME_ASH_PARTICLE_SIZE,
    borderRadius: BIOME_ASH_PARTICLE_RADIUS,
    backgroundColor: BIOME_ASH_PARTICLE_COLOR,
  },
});
