import { ClimateClusterId, SectorDefinition } from '../types/run';

export interface ClimateClusterDefinition {
  id: ClimateClusterId;
  name: string;
  tagline: string;
  biomes: SectorDefinition[];
}

export const CLIMATE_CLUSTERS: Record<ClimateClusterId, ClimateClusterDefinition> = {
  URBAN: {
    id: 'URBAN',
    name: 'THE URBAN BREACH',
    tagline: 'Hospital wards, flooded sewers, neon alleyways.',
    biomes: [
      { id: 'urban-hospital', name: 'St. Jude Hospital', subsector: 'Intensive Care Unit', theme: 'HOSPITAL', description: 'Flatlined monitors flicker with ectoplasmic interference.' },
      { id: 'urban-sewers', name: 'Flooded Sewers', subsector: 'Overflow Tunnels', theme: 'CITY', description: 'Waist-deep blackwater pulses with bioluminescent spores.' },
      { id: 'urban-neon', name: 'Neon Alleyways', subsector: 'Velvet Theater District', theme: 'CITY', description: 'Marquees strobe phantom headlines. Velvet curtains breathe.' },
    ],
  },
  ISOLATED: {
    id: 'ISOLATED',
    name: 'THE ISOLATED BREACH',
    tagline: 'School basements, hallowed churches.',
    biomes: [
      { id: 'iso-school', name: 'Abandoned Academy', subsector: 'School Basement', theme: 'HOUSING', description: 'Lockers dent inward without touch. Chalk writes itself.' },
      { id: 'iso-church', name: 'Hallowed Churches', subsector: 'Bell-Tower Nave', theme: 'HOSPITAL', description: 'Candles relight in sequence. Bells toll at wrong hours.' },
      { id: 'iso-chapel', name: 'Hallowed Churches', subsector: 'Crypt Annex', theme: 'HOSPITAL', description: 'Pew nails weep rust. Confessionals whisper your name.' },
    ],
  },
  WILDERNESS: {
    id: 'WILDERNESS',
    name: 'THE WILDERNESS BREACH',
    tagline: 'Forest, swamp, canyon, static beach.',
    biomes: [
      { id: 'wild-forest', name: 'Forgotten Forest', subsector: 'Breach Point', theme: 'FOREST', description: 'Ancient roots pierce asphalt. Starlight leaks through canopy.' },
      { id: 'wild-swamp', name: 'Sunken Swamps', subsector: 'Bog Cathedral', theme: 'FOREST', description: 'Gas pockets burst with faces. Reeds scrape like nails.' },
      { id: 'wild-canyon', name: 'Shattered Mountains', subsector: 'Glass Canyon', theme: 'FOREST', description: 'Wind screams through fault lines. Stone remembers falling.' },
      { id: 'wild-beach', name: 'Static Beaches', subsector: 'Tide-Frozen Shore', theme: 'FOREST', description: 'Waves freeze mid-crash. Sand grains buzz with white noise.' },
    ],
  },
};

const CLUSTER_IDS: ClimateClusterId[] = ['URBAN', 'ISOLATED', 'WILDERNESS'];

export function pickRandomClimateCluster(): ClimateClusterId {
  return CLUSTER_IDS[Math.floor(Math.random() * CLUSTER_IDS.length)];
}

export function getClusterDefinition(clusterId: ClimateClusterId): ClimateClusterDefinition {
  return CLIMATE_CLUSTERS[clusterId];
}

export function getClusterBiomes(clusterId: ClimateClusterId): SectorDefinition[] {
  return CLIMATE_CLUSTERS[clusterId].biomes;
}
