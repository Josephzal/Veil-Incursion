import type { MapPoint, SectorMapGeometry } from '../types/regional';
import type {
  CabalEmployerId,
  OperationObjectiveKind,
  SectorId,
  VeilAnchorType,
} from '../types/worldState';
import { parseLowPolyPath, polygonCentroid } from '../utils/sectorInfluenceVisual';

export const SECTOR_MAP_VIEWBOX = { width: 480, height: 320 };

export interface SectorMapDefinition {
  id: SectorId;
  label: string;
  mapGeometry: SectorMapGeometry;
}

export interface SectorOperationTemplate {
  id: string;
  title: string;
  description: string;
  objectiveKind: OperationObjectiveKind;
  rewardEmphasis: import('../types/worldState').RewardEmphasis;
}

export interface SectorWorldTemplate {
  id: SectorId;
  displayName: string;
  biome: string;
  hazardLevel: number;
  rewardLevel: number;
  resourceFocus: string[];
  echoActivity: 'LOW' | 'ELEVATED' | 'CRITICAL';
  employerPresence: CabalEmployerId[];
  anchor: {
    type: VeilAnchorType;
    displayName: string;
    description: string;
  } | null;
  operations: SectorOperationTemplate[];
}

const RAW_MAP: Array<{ id: SectorId; label: string; path: string }> = [
  { id: 'THE_SLAG_WORKS', label: 'The Slag Works', path: 'M 40 60 L 120 40 L 150 110 L 90 150 L 30 120 Z' },
  { id: 'THE_ABYSSAL_SINK', label: 'Abyssal Sink', path: 'M 30 190 L 110 170 L 140 260 L 60 280 L 20 230 Z' },
  { id: 'THE_NULL_ZONE', label: 'Null Zone', path: 'M 190 110 L 290 90 L 320 170 L 250 210 L 170 180 Z' },
  { id: 'THE_BLACKLINE_TERMINUS', label: 'The Blackline Terminus', path: 'M 330 40 L 430 55 L 450 130 L 370 150 L 310 95 Z' },
  { id: 'THE_ASHEN_WASTES', label: 'Ashen Wastes', path: 'M 300 190 L 420 175 L 460 260 L 360 290 L 280 240 Z' },
];

export const SECTOR_MAP_DEFINITIONS: SectorMapDefinition[] = RAW_MAP.map((entry) => {
  const polygon = parseLowPolyPath(entry.path);
  const centroid = polygonCentroid(polygon);
  return {
    id: entry.id,
    label: entry.label,
    mapGeometry: {
      path: entry.path,
      polygon,
      labelAnchor: centroid,
      nodeAnchor: { x: centroid.x, y: centroid.y - 12 },
    },
  };
});

export const SECTOR_WORLD_TEMPLATES: SectorWorldTemplate[] = [
  {
    id: 'THE_SLAG_WORKS',
    displayName: 'The Slag Works',
    biome: 'Industrial Ley Slag',
    hazardLevel: 3,
    rewardLevel: 3,
    resourceFocus: ['Ley Slag', 'Echo Cores'],
    echoActivity: 'ELEVATED',
    employerPresence: ['LEGION', 'TERRAN_GRID'],
    anchor: {
      type: 'CHOIR_SPIRE',
      displayName: 'Choir Spire',
      description: 'A harmonic Veil structure bleeding resonance through the slag channels.',
    },
    operations: [
      {
        id: 'op-slag-choir-collapse',
        title: 'Collapse the Choir Spire',
        description: 'Trace the harmonic bleed and breach the Choir Spire core before it stabilizes.',
        objectiveKind: 'ANCHOR_ASSAULT',
        rewardEmphasis: { echoCores: 1, rareLoot: 0.15 },
      },
      {
        id: 'op-slag-ley-survey',
        title: 'Survey the Ley Veins',
        description: 'Map slag-channel ley bleed before the Choir Spire re-harmonizes.',
        objectiveKind: 'RESOURCE_SURVEY',
        rewardEmphasis: { targetResources: ['Ley Slag'], rareLoot: 0.1 },
      },
    ],
  },
  {
    id: 'THE_ABYSSAL_SINK',
    displayName: 'Abyssal Sink',
    biome: 'Submerged Null Caverns',
    hazardLevel: 4,
    rewardLevel: 3,
    resourceFocus: ['Null Filament', 'Anomalous Core'],
    echoActivity: 'CRITICAL',
    employerPresence: ['SOLARIS', 'LEGION'],
    anchor: {
      type: 'NULL_MONOLITH',
      displayName: 'Null Monolith',
      description: 'A silent monolith that erases signal and memory in widening rings.',
    },
    operations: [
      {
        id: 'op-abyss-echo-recovery',
        title: 'Echo Recovery Sweep',
        description: 'Recover echo signatures before the Null Monolith dissolves them entirely.',
        objectiveKind: 'ECHO_RECOVERY',
        rewardEmphasis: { echoCores: 2, credits: 0.1 },
      },
      {
        id: 'op-abyss-null-containment',
        title: 'Null Field Containment',
        description: 'Stabilize null rings around the monolith before echo bleed escalates.',
        objectiveKind: 'ANCHOR_ASSAULT',
        rewardEmphasis: { echoCores: 1, rareLoot: 0.12 },
      },
    ],
  },
  {
    id: 'THE_NULL_ZONE',
    displayName: 'Null Zone',
    biome: 'Signal Deadlands',
    hazardLevel: 3,
    rewardLevel: 4,
    resourceFocus: ['Encrypted Grid Drive', 'Echo Glass Shard'],
    echoActivity: 'LOW',
    employerPresence: ['TERRAN_GRID', 'SOLARIS'],
    anchor: {
      type: 'LEY_NEXUS',
      displayName: 'Ley Nexus',
      description: 'A crossroads of ley veins where loot density spikes and paths fracture.',
    },
    operations: [
      {
        id: 'op-null-extraction-surge',
        title: 'Extraction Surge',
        description: 'Maximize extraction throughput while the Ley Nexus amplifies cargo yield.',
        objectiveKind: 'EXTRACTION_SURGE',
        rewardEmphasis: { credits: 0.2, rareLoot: 0.1 },
      },
      {
        id: 'op-null-grid-recovery',
        title: 'Grid Drive Recovery',
        description: 'Recover encrypted grid drives from deadland fracture pockets.',
        objectiveKind: 'RESOURCE_SURVEY',
        rewardEmphasis: { targetResources: ['Encrypted Grid Drive'], credits: 0.15 },
      },
    ],
  },
  {
    id: 'THE_BLACKLINE_TERMINUS',
    displayName: 'The Blackline Terminus',
    biome: 'Transit Corruption Grid',
    hazardLevel: 2,
    rewardLevel: 3,
    resourceFocus: ['Transit Scrap', 'Ley Slag'],
    echoActivity: 'ELEVATED',
    employerPresence: ['TERRAN_GRID', 'SOLARIS', 'LEGION'],
    anchor: {
      type: 'RIFT_ENGINE',
      displayName: 'Rift Engine',
      description: 'A churning Veil engine that warps patrol routes and spawns unstable rifts.',
    },
    operations: [
      {
        id: 'op-blackline-resource-survey',
        title: 'Survey the Ley Veins',
        description: 'Map unstable transit veins and secure high-value salvage corridors.',
        objectiveKind: 'RESOURCE_SURVEY',
        rewardEmphasis: { targetResources: ['Ley Slag', 'Transit Scrap'] },
      },
      {
        id: 'op-blackline-transit-lockdown',
        title: 'Transit Vein Lockdown',
        description: 'Suppress rift engine bleed along the Blackline before routes collapse.',
        objectiveKind: 'BOSS_SUPPRESSION',
        rewardEmphasis: { rareLoot: 0.15, credits: 0.1 },
      },
    ],
  },
  {
    id: 'THE_ASHEN_WASTES',
    displayName: 'Ashen Wastes',
    biome: 'Barren Backroads',
    hazardLevel: 5,
    rewardLevel: 4,
    resourceFocus: ['Anomalous Core', 'Echo Cores'],
    echoActivity: 'CRITICAL',
    employerPresence: ['LEGION', 'SOLARIS'],
    anchor: {
      type: 'ASHEN_HEART',
      displayName: 'Ashen Heart',
      description: 'A calcified Veil heart that spawns elite anomalies and deep echo bleed.',
    },
    operations: [
      {
        id: 'op-fractal-boss-suppression',
        title: 'Suppress the Ashen Heart',
        description: 'Break elite nests feeding the Ashen Heart before the wastes fully awaken.',
        objectiveKind: 'BOSS_SUPPRESSION',
        rewardEmphasis: { rareLoot: 0.25, echoCores: 1 },
      },
      {
        id: 'op-fractal-echo-salvage',
        title: 'Echo Core Salvage',
        description: 'Harvest echo cores from recursive waste bleed before they desync.',
        objectiveKind: 'ECHO_RECOVERY',
        rewardEmphasis: { echoCores: 2, rareLoot: 0.2 },
      },
    ],
  },
];

export function getSectorMapDefinition(id: SectorId): SectorMapDefinition {
  return SECTOR_MAP_DEFINITIONS.find((s) => s.id === id) ?? SECTOR_MAP_DEFINITIONS[0];
}

export function getSectorWorldTemplate(id: SectorId): SectorWorldTemplate {
  return SECTOR_WORLD_TEMPLATES.find((s) => s.id === id) ?? SECTOR_WORLD_TEMPLATES[0];
}

export function getActiveSectorOperationTemplate(
  sectorId: SectorId,
  operationIndex = 0,
): SectorOperationTemplate {
  const template = getSectorWorldTemplate(sectorId);
  const index = ((operationIndex % template.operations.length) + template.operations.length)
    % template.operations.length;
  return template.operations[index] ?? template.operations[0];
}

export function getNextSectorOperationTemplate(
  sectorId: SectorId,
  operationIndex: number,
): SectorOperationTemplate {
  const template = getSectorWorldTemplate(sectorId);
  return getActiveSectorOperationTemplate(sectorId, operationIndex + 1);
}

export function anchorIdForSector(sectorId: SectorId, anchorType: VeilAnchorType): string {
  return `anchor-${sectorId.toLowerCase()}-${anchorType.toLowerCase()}`;
}

export function defaultAnchorRealityRules(anchorType: VeilAnchorType): import('../types/worldState').AnchorRealityRules {
  switch (anchorType) {
    case 'CHOIR_SPIRE':
      return { combatBias: 0.05, eliteBias: 0.1, anomalyBias: 0.15, echoBias: 0.2, lootBias: 0.05, extractionRiskBias: 0.1 };
    case 'LEY_NEXUS':
      return { combatBias: 0, eliteBias: 0, anomalyBias: 0.1, echoBias: 0, lootBias: 0.25, extractionRiskBias: 0.05 };
    case 'NULL_MONOLITH':
      return { combatBias: 0.1, eliteBias: 0.15, anomalyBias: 0.2, echoBias: 0.25, lootBias: 0, extractionRiskBias: 0.15 };
    case 'RIFT_ENGINE':
      return { combatBias: 0.15, eliteBias: 0.1, anomalyBias: 0.25, echoBias: 0.1, lootBias: 0.1, extractionRiskBias: 0.2 };
    case 'ASHEN_HEART':
      return { combatBias: 0.05, eliteBias: 0.25, anomalyBias: 0.15, echoBias: 0.3, lootBias: 0.15, extractionRiskBias: 0.25 };
    default:
      return { combatBias: 0, eliteBias: 0, anomalyBias: 0, echoBias: 0, lootBias: 0, extractionRiskBias: 0 };
  }
}

export function centroidForSector(id: SectorId): MapPoint {
  return getSectorMapDefinition(id).mapGeometry.labelAnchor;
}
