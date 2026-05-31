import { BiomeType } from '../types/game';
import { SectorDefinition } from '../types/run';

/** Canonical sector definitions keyed by persistent biome unlock type. */
export const BIOME_SECTORS: Record<BiomeType, SectorDefinition> = {
  HOSPITAL: {
    id: 'biome-hospital',
    name: 'St. Jude Hospital',
    subsector: 'Intensive Care Unit',
    theme: 'HOSPITAL',
    description: 'Flatlined monitors flicker with ectoplasmic interference.',
  },
  ALLEYWAYS: {
    id: 'biome-alleyways',
    name: 'Neon Alleyways',
    subsector: 'Velvet Theater District',
    theme: 'CITY',
    description: 'Marquees strobe phantom headlines. Velvet curtains breathe.',
  },
  SEWERS: {
    id: 'biome-sewers',
    name: 'Flooded Sewers',
    subsector: 'Overflow Tunnels',
    theme: 'CITY',
    description: 'Waist-deep blackwater pulses with bioluminescent spores.',
  },
  CHURCH: {
    id: 'biome-church',
    name: 'Hallowed Churches',
    subsector: 'Bell-Tower Nave',
    theme: 'HOSPITAL',
    description: 'Candles relight in sequence. Bells toll at wrong hours.',
  },
  FOREST: {
    id: 'biome-forest',
    name: 'Forgotten Forest',
    subsector: 'Breach Point',
    theme: 'FOREST',
    description: 'Ancient roots pierce asphalt. Starlight leaks through canopy.',
  },
  CANYON: {
    id: 'biome-canyon',
    name: 'Shattered Mountains',
    subsector: 'Glass Canyon',
    theme: 'FOREST',
    description: 'Wind screams through fault lines. Stone remembers falling.',
  },
};

export function getUnlockedSectors(unlockedBiomes: BiomeType[]): SectorDefinition[] {
  return unlockedBiomes.map((biome) => BIOME_SECTORS[biome]);
}

export function pickSectorFromUnlocked(
  unlockedBiomes: BiomeType[],
  usedIds: Set<string>,
): SectorDefinition | null {
  const shuffled = [...unlockedBiomes].sort(() => Math.random() - 0.5);
  for (const biome of shuffled) {
    const sector = BIOME_SECTORS[biome];
    if (usedIds.has(sector.id)) continue;
    usedIds.add(sector.id);
    return sector;
  }
  return null;
}
