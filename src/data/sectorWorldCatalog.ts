import type { MapPoint, SectorMapGeometry } from '../types/regional';
import type {
  OperationBonusObjective,
  OperationEnemyRole,
  OperationSignalOverlay,
} from '../types/operationProcedural';
import type { RunDepth } from '../types/narrativeProcedural';
import type { ResourceItemId } from '../types/resourceItem';
import type {
  CabalEmployerId,
  OperationCompletionEffect,
  OperationContributionRules,
  OperationObjectiveKind,
  SectorId,
  VeilAnchorType,
} from '../types/worldState';
import { parseLowPolyPath } from '../utils/sectorInfluenceVisual';
import { getAnchorRealityRules } from './anchorRegistry';
import { VEIL_FRONT_MAP_SECTORS, VEIL_FRONT_MAP_VIEWBOX } from './veilFrontMapGeometry';

export const SECTOR_MAP_VIEWBOX = {
  width: VEIL_FRONT_MAP_VIEWBOX.width,
  height: VEIL_FRONT_MAP_VIEWBOX.height,
};

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
  /** Operations v2 — procedural instance fields (optional on static starters). */
  procedural?: boolean;
  generationSeed?: string;
  operationIndex?: number;
  createdAtRunIndex?: number;
  targetAnchorType?: VeilAnchorType | null;
  targetAnchorDisplayName?: string | null;
  targetResourceIds?: ResourceItemId[];
  targetDepths?: RunDepth[];
  targetEnemyRoles?: OperationEnemyRole[];
  targetNodeOverlays?: OperationSignalOverlay[];
  progressRequired?: number;
  contributionRules?: OperationContributionRules;
  bonusObjectives?: OperationBonusObjective[];
  completionEffect?: OperationCompletionEffect;
  completionEffectSummary?: string;
  operationTags?: string[];
  titleHash?: string;
  recentMemoryKey?: string;
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

/** Sector hit/clip polygons — exact Figma paths against veil-front-map-base.png (1672×941). */
export const SECTOR_MAP_DEFINITIONS: SectorMapDefinition[] = VEIL_FRONT_MAP_SECTORS.map((entry) => {
  const polygon = parseLowPolyPath(entry.path);
  return {
    id: entry.id,
    label: entry.name,
    mapGeometry: {
      path: entry.path,
      polygon,
      labelAnchor: entry.label,
      nodeAnchor: { x: entry.label.x, y: entry.label.y - 12 },
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
    resourceFocus: ['Rail Capacitor', 'Blood-Iron', 'Ley-Slag'],
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
    resourceFocus: ['Mycelial Ichor', 'Sanguine Ampoule', 'Echo-Glass'],
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
    resourceFocus: ['Nullcrete', 'Echo-Glass', 'Ley-Slag'],
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
    resourceFocus: ['Containment Seal', 'Grid-Drive', 'Breach Thread'],
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
        rewardEmphasis: { targetResources: ['Containment Seal', 'Breach Thread'] },
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
    resourceFocus: ['Cinder Wire', 'Veil-Ash', 'Echo-Glass'],
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
  return getAnchorRealityRules(anchorType);
}

export function centroidForSector(id: SectorId): MapPoint {
  return getSectorMapDefinition(id).mapGeometry.labelAnchor;
}
