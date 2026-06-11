import {
  IncursionBiome,
  IncursionEncounterType,
  IncursionNode,
  RunNodeType,
} from '../types/game';
import { EncounterType, RadarDot, SectorDefinition } from '../types/run';
import { INCURSION_ENCOUNTER_COUNT } from '../types/run';
import {
  createRadarDotFromPolar,
  layoutRadarDotsOnScanner,
} from './scannerNodeLayout';
import { INITIAL_SECTOR_POOL } from './regions';
import { createDistrictGateBossProfile } from './districtBosses';

export const BOSS_ENCOUNTER_INDEX = 9;
export const PENULT_ENCOUNTER_INDEX = 8;
export const MANDATORY_SANCTUARY_ENCOUNTER = 3;
export const MIDDLE_SANCTUARY_CANDIDATES = [1, 2, 4, 5, 6] as const;

const DEPTH_LABELS: Record<number, string> = {
  1: 'THRESHOLD',
  2: 'DEEP BLEED',
  3: 'ABYSSAL CORE',
};

const VECTOR_DESIGNATIONS = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA', 'ETA'] as const;

const SIGNATURE_PROFILES = [
  'HIGH FREQUENCY ENERGY SPIKE',
  'PHASE-LOCKED DISTORTION BAND',
  'UNSTABLE VEIL RESONANCE',
  'LOW-BANDWIDTH GRAVITIC PULSE',
  'SPECTRAL EMISSION CASCADE',
  'CONTAINMENT FIELD FLUCTUATION',
  'ANOMALOUS THERMAL SIGNATURE',
] as const;

export const BIOME_CONTEXT_LOG: Record<IncursionBiome, string> = {
  CITY_STREETS: 'BIOME ANCHOR // URBAN STREET GRID — CONCRETE CANYON SECTOR',
  HOSPITAL: 'BIOME ANCHOR // MEDICAL WING — STERILE CORRIDOR SECTOR',
  LABORATORY: 'BIOME ANCHOR // RESEARCH SUBLEVEL — CONTAINMENT LAB SECTOR',
  SECTOR_CORE: 'BIOME ANCHOR // SECTOR CORE — PRIMARY THREAT CONDUIT',
};

export const BIOME_DISPLAY_LABEL: Record<IncursionBiome, string> = {
  CITY_STREETS: 'City Streets',
  HOSPITAL: 'Hospital',
  LABORATORY: 'Laboratory',
  SECTOR_CORE: 'Sector Core',
};

export const ENCOUNTER_DISPLAY_LABEL: Record<IncursionEncounterType, string> = {
  COMBAT: 'Combat',
  NARRATIVE_EVENT: 'Narrative Event',
  SANCTUARY: 'Sanctuary',
  BLACK_MARKET: 'Black Market',
  RESOURCE_HARVEST: 'Resource Node',
};

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function buildMaskedScanTelemetry(
  nodeId: string,
  optionIndex: number,
): { pingLabel: string; label: string } {
  const designation = VECTOR_DESIGNATIONS[optionIndex % VECTOR_DESIGNATIONS.length];
  const seed = hashSeed(nodeId);
  const refId = 1000 + (seed % 9000);
  const signature = SIGNATURE_PROFILES[seed % SIGNATURE_PROFILES.length];
  return {
    pingLabel: `VECTOR ${designation}`,
    label: `REF-ID: ANOMALY-${refId} // SIGNATURE: ${signature}`,
  };
}

function randomBranchCount(): number {
  return 1 + Math.floor(Math.random() * 3);
}

export function encounterToRunNodeType(
  encounterType: IncursionEncounterType,
  encounterIndex: number,
): RunNodeType {
  if (encounterType === 'SANCTUARY') return 'SANCTUARY';
  if (encounterType === 'NARRATIVE_EVENT') return 'NARRATIVE_EVENT';
  if (encounterType === 'BLACK_MARKET') return 'BLACK_MARKET';
  return encounterIndex === BOSS_ENCOUNTER_INDEX ? 'BOSS_COMBAT' : 'STANDARD_COMBAT';
}

export function isCombatNodeType(type: RunNodeType): boolean {
  return type === 'STANDARD_COMBAT' || type === 'ELITE_COMBAT' || type === 'BOSS_COMBAT';
}

function rollFlexibleEncounter(): IncursionEncounterType {
  return Math.random() < 0.45 ? 'NARRATIVE_EVENT' : 'COMBAT';
}

export function resolveBiomeForOption(
  _encounterIndex: number,
  _optionIndex: number,
  _priorBiome: IncursionBiome | null,
): IncursionBiome {
  return 'CITY_STREETS';
}

export function resolveBossBiome(_encounterPath: IncursionNode[]): IncursionBiome {
  return 'CITY_STREETS';
}

function makeVectorNode(
  depth: number,
  encounterIndex: number,
  optionIndex: number,
  encounterType: IncursionEncounterType,
  biome: IncursionBiome,
  isPreDiscovered = false,
): IncursionNode {
  const id = `depth${depth}-enc${encounterIndex}-o${optionIndex}`;
  const masked = buildMaskedScanTelemetry(id, optionIndex);
  const prefix = DEPTH_LABELS[depth] ?? `DEPTH ${depth}`;
  const type = encounterToRunNodeType(encounterType, encounterIndex);

  return {
    id,
    encounterIndex,
    index: encounterIndex,
    encounterType,
    biome,
    type,
    label: `${prefix} // ${masked.label}`,
    isCompleted: false,
    isPreDiscovered,
  };
}

/** Encounter 0 — combat, narrative, and black market vectors. */
function buildFirstScanCluster(depth: number): IncursionNode[] {
  return [
    makeVectorNode(depth, 0, 0, 'COMBAT', 'CITY_STREETS'),
    makeVectorNode(depth, 0, 1, 'NARRATIVE_EVENT', 'CITY_STREETS'),
    makeVectorNode(depth, 0, 2, 'BLACK_MARKET', 'CITY_STREETS'),
  ];
}

function buildFlexibleCluster(
  depth: number,
  encounterIndex: number,
  count: number,
  forcedSanctuarySlot: number,
  priorBiome: IncursionBiome,
): IncursionNode[] {
  const cluster: IncursionNode[] = [];

  for (let i = 0; i < count; i += 1) {
    const biome = resolveBiomeForOption(encounterIndex, i, priorBiome);
    if (i === forcedSanctuarySlot) {
      cluster.push(makeVectorNode(depth, encounterIndex, i, 'SANCTUARY', biome));
    } else {
      cluster.push(makeVectorNode(depth, encounterIndex, i, rollFlexibleEncounter(), biome));
    }
  }

  return cluster;
}

/** Pre-generate 10 encounter-step vector clusters for a depth run. */
export function generateDepthEncounterMatrix(depth: number): {
  encounterOptionClusters: IncursionNode[][];
  earlySanctuarySpawned: boolean;
} {
  const matrix: IncursionNode[][] = [];
  const middleSanctuaryEncounter =
    MIDDLE_SANCTUARY_CANDIDATES[Math.floor(Math.random() * MIDDLE_SANCTUARY_CANDIDATES.length)];

  for (let encounter = 0; encounter < INCURSION_ENCOUNTER_COUNT; encounter += 1) {
    if (encounter === 0) {
      matrix[0] = buildFirstScanCluster(depth);
      continue;
    }

    if (encounter === 2) {
      matrix[2] = [
        makeVectorNode(depth, 2, 0, 'COMBAT', 'CITY_STREETS'),
        makeVectorNode(depth, 2, 1, 'BLACK_MARKET', 'CITY_STREETS'),
        makeVectorNode(depth, 2, 2, 'NARRATIVE_EVENT', 'CITY_STREETS'),
      ];
      continue;
    }

    if (encounter === PENULT_ENCOUNTER_INDEX) {
      matrix[PENULT_ENCOUNTER_INDEX] = [
        makeVectorNode(depth, PENULT_ENCOUNTER_INDEX, 0, 'SANCTUARY', 'CITY_STREETS'),
        makeVectorNode(depth, PENULT_ENCOUNTER_INDEX, 1, 'NARRATIVE_EVENT', 'CITY_STREETS'),
      ];
      continue;
    }

    if (encounter === BOSS_ENCOUNTER_INDEX) {
      matrix[BOSS_ENCOUNTER_INDEX] = [
        makeVectorNode(depth, BOSS_ENCOUNTER_INDEX, 0, 'COMBAT', 'CITY_STREETS', true),
      ];
      continue;
    }

    if (encounter === MANDATORY_SANCTUARY_ENCOUNTER) {
      const count = randomBranchCount();
      const sanctuarySlot = Math.floor(Math.random() * count);
      matrix[encounter] = buildFlexibleCluster(depth, encounter, count, sanctuarySlot, 'CITY_STREETS');
      continue;
    }

    if (MIDDLE_SANCTUARY_CANDIDATES.includes(encounter as (typeof MIDDLE_SANCTUARY_CANDIDATES)[number])) {
      const count = randomBranchCount();
      const sanctuarySlot = encounter === middleSanctuaryEncounter ? Math.floor(Math.random() * count) : -1;
      matrix[encounter] = buildFlexibleCluster(
        depth,
        encounter,
        count,
        sanctuarySlot,
        'CITY_STREETS',
      );
      continue;
    }

    const count = randomBranchCount();
    matrix[encounter] = buildFlexibleCluster(depth, encounter, count, -1, 'CITY_STREETS');
  }

  const earlySanctuarySpawned = matrix.some(
    (cluster, encounter) =>
      encounter !== PENULT_ENCOUNTER_INDEX &&
      encounter !== BOSS_ENCOUNTER_INDEX &&
      cluster.some((node) => node.encounterType === 'SANCTUARY'),
  );

  return { encounterOptionClusters: matrix, earlySanctuarySpawned };
}

export function createPlaceholderDepthPath(): IncursionNode[] {
  return Array.from({ length: INCURSION_ENCOUNTER_COUNT }, (_, encounterIndex) => ({
    id: `pending-${encounterIndex}`,
    encounterIndex,
    index: encounterIndex,
    encounterType: 'COMBAT' as IncursionEncounterType,
    type: 'STANDARD_COMBAT' as RunNodeType,
    biome: 'CITY_STREETS' as IncursionBiome,
    label: `ENCOUNTER ${encounterIndex + 1} // AWAITING VECTOR LOCK`,
    isCompleted: false,
  }));
}

export function finalizeClusterForScan(
  cluster: IncursionNode[],
  encounterIndex: number,
  encounterPath: IncursionNode[],
  _depth: number,
): IncursionNode[] {
  const priorBiome =
    encounterIndex > 0 ? encounterPath[encounterIndex - 1]?.biome ?? 'CITY_STREETS' : 'CITY_STREETS';

  return cluster.map((node, optionIndex) => {
    const biome = node.encounterType === 'SANCTUARY'
      ? (priorBiome ?? 'CITY_STREETS')
      : resolveBiomeForOption(encounterIndex, optionIndex, priorBiome);

    const encounterType =
      encounterIndex === BOSS_ENCOUNTER_INDEX ? 'COMBAT' : node.encounterType;

    const type = encounterToRunNodeType(encounterType, encounterIndex);

    return {
      ...node,
      encounterIndex,
      index: encounterIndex,
      encounterType,
      biome,
      type,
      isPreDiscovered: encounterIndex === BOSS_ENCOUNTER_INDEX ? true : node.isPreDiscovered,
    };
  });
}

function incursionEncounterToRadarType(encounterType: IncursionEncounterType): EncounterType {
  switch (encounterType) {
    case 'SANCTUARY':
      return 'REST';
    case 'NARRATIVE_EVENT':
      return 'SKILL_CHECK';
    case 'BLACK_MARKET':
      return 'REST';
    default:
      return 'COMBAT';
  }
}

export function generateDepthNodeScanVectors(
  nodes: IncursionNode[],
  scannerSizePx: number,
  sector: SectorDefinition = INITIAL_SECTOR_POOL[0],
  rng: () => number = Math.random,
): RadarDot[] {
  if (nodes.length === 0) return [];

  return layoutRadarDotsOnScanner(
    nodes,
    scannerSizePx,
    (node, index, position) => {
      const masked = buildMaskedScanTelemetry(node.id, index);
      return createRadarDotFromPolar(
        node,
        index,
        position,
        sector,
        {
          encounterType: incursionEncounterToRadarType(node.encounterType),
          label: masked.label,
          pingLabel: node.isPreDiscovered
            ? 'PRIORITY TARGET // MANIFESTED CORE'
            : masked.pingLabel,
        },
      );
    },
    rng,
  );
}

export function getDepthScale(depth: number): number {
  return 1 + (depth - 1) * 0.25;
}

const DEFAULT_BOSS_PHASES = [
  {
    phaseNumber: 1,
    phaseName: 'Standard Operations',
    triggerHpThreshold: 51,
    intentModifier: 'Low-depth conduit strikes',
  },
  {
    phaseNumber: 2,
    phaseName: 'Rift Overdrive',
    triggerHpThreshold: 50,
    intentModifier: 'Catastrophic overdrive discharge',
  },
];

export function createBossProfileForDepth(depth: number): import('../types/game').BossRuntimeProfile {
  const gateDepth = depth === 15 || depth === 30 || depth === 45
    ? depth
    : depth <= 15
      ? 15
      : depth <= 30
        ? 30
        : 45;
  return createDistrictGateBossProfile(gateDepth);
}

export function isBossNodeType(type: RunNodeType): boolean {
  return type === 'BOSS_COMBAT' || type === 'ELITE_COMBAT';
}

export function findVectorInCluster(
  cluster: IncursionNode[],
  nodeId: string,
): IncursionNode | null {
  return cluster.find((n) => n.id === nodeId) ?? null;
}

export function getBiomeContextLog(biome: IncursionBiome): string {
  return BIOME_CONTEXT_LOG[biome];
}

export function getEncounterDisplayLabel(
  encounterType: IncursionEncounterType,
  encounterIndex: number,
): string {
  if (encounterType === 'COMBAT' && encounterIndex === BOSS_ENCOUNTER_INDEX) {
    return 'Boss Combat';
  }
  return ENCOUNTER_DISPLAY_LABEL[encounterType];
}

export function resolveVectorLabel(node: IncursionNode, optionIndex = 0): string {
  const head = node.label.split(' // ')[0]?.trim();
  if (head?.startsWith('VECTOR ')) return head;
  return buildMaskedScanTelemetry(node.id, optionIndex).pingLabel;
}

/** Scanner dock readout — biome, vector designation, and node type only. */
export function formatScannerNodeIntel(node: IncursionNode, optionIndex = 0): string[] {
  const vector = resolveVectorLabel(node, optionIndex);
  const nodeType = node.type.replace(/_/g, ' ');
  return [
    `> BIOME: ${BIOME_DISPLAY_LABEL[node.biome].toUpperCase()}`,
    `> VECTOR: ${vector}`,
    `> NODE TYPE: ${nodeType.toUpperCase()}`,
  ];
}
