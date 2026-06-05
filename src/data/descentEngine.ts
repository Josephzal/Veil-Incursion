import {
  IncursionBiome,
  IncursionEncounterType,
  IncursionNode,
  RunNodeType,
} from '../types/game';
import { EncounterType, RadarDot, SectorDefinition } from '../types/run';
import { INCURSION_DEPTH_COUNT } from '../types/run';
import {
  createRadarDotFromPolar,
  layoutRadarDotsOnScanner,
} from './scannerNodeLayout';
import { INITIAL_SECTOR_POOL } from './regions';

export const BOSS_DEPTH_INDEX = 9;
export const PENULT_DEPTH_INDEX = 8;
export const MANDATORY_SANCTUARY_DEPTH = 3;
export const MIDDLE_SANCTUARY_CANDIDATES = [1, 2, 4, 5, 6] as const;

const TIER_LABELS: Record<number, string> = {
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
  depthIndex: number,
): RunNodeType {
  if (encounterType === 'SANCTUARY') return 'SANCTUARY';
  if (encounterType === 'NARRATIVE_EVENT') return 'NARRATIVE_EVENT';
  return depthIndex === BOSS_DEPTH_INDEX ? 'BOSS_COMBAT' : 'STANDARD_COMBAT';
}

export function isCombatNodeType(type: RunNodeType): boolean {
  return type === 'STANDARD_COMBAT' || type === 'ELITE_COMBAT' || type === 'BOSS_COMBAT';
}

function rollFlexibleEncounter(): IncursionEncounterType {
  return Math.random() < 0.45 ? 'NARRATIVE_EVENT' : 'COMBAT';
}

export function resolveBiomeForOption(
  _depthIndex: number,
  _optionIndex: number,
  _priorBiome: IncursionBiome | null,
): IncursionBiome {
  return 'CITY_STREETS';
}

export function resolveBossBiome(_tierNodes: IncursionNode[]): IncursionBiome {
  return 'CITY_STREETS';
}

function makeVectorNode(
  tier: number,
  depthIndex: number,
  optionIndex: number,
  encounterType: IncursionEncounterType,
  biome: IncursionBiome,
  isPreDiscovered = false,
): IncursionNode {
  const id = `t${tier}-d${depthIndex}-o${optionIndex}`;
  const masked = buildMaskedScanTelemetry(id, optionIndex);
  const prefix = TIER_LABELS[tier] ?? `TIER ${tier}`;
  const type = encounterToRunNodeType(encounterType, depthIndex);

  return {
    id,
    depthIndex,
    index: depthIndex,
    encounterType,
    biome,
    type,
    label: `${prefix} // ${masked.label}`,
    isCompleted: false,
    isPreDiscovered,
  };
}

/** Depth 0 — exactly two vectors: one combat, one narrative. */
function buildFirstScanCluster(tier: number): IncursionNode[] {
  return [
    makeVectorNode(tier, 0, 0, 'COMBAT', 'CITY_STREETS'),
    makeVectorNode(tier, 0, 1, 'NARRATIVE_EVENT', 'CITY_STREETS'),
  ];
}

function buildFlexibleCluster(
  tier: number,
  depthIndex: number,
  count: number,
  forcedSanctuarySlot: number,
  priorBiome: IncursionBiome,
): IncursionNode[] {
  const cluster: IncursionNode[] = [];

  for (let i = 0; i < count; i += 1) {
    const biome = resolveBiomeForOption(depthIndex, i, priorBiome);
    if (i === forcedSanctuarySlot) {
      cluster.push(makeVectorNode(tier, depthIndex, i, 'SANCTUARY', biome));
    } else {
      cluster.push(makeVectorNode(tier, depthIndex, i, rollFlexibleEncounter(), biome));
    }
  }

  return cluster;
}

/** Pre-generate 10 depth-step vector clusters for a tier run. */
export function generateTierVectorMatrix(tier: number): {
  activeTierVectors: IncursionNode[][];
  earlySanctuarySpawned: boolean;
} {
  const matrix: IncursionNode[][] = [];
  const middleSanctuaryDepth =
    MIDDLE_SANCTUARY_CANDIDATES[Math.floor(Math.random() * MIDDLE_SANCTUARY_CANDIDATES.length)];

  for (let depth = 0; depth < INCURSION_DEPTH_COUNT; depth += 1) {
    if (depth === 0) {
      matrix[0] = buildFirstScanCluster(tier);
      continue;
    }

    if (depth === PENULT_DEPTH_INDEX) {
      matrix[PENULT_DEPTH_INDEX] = [
        makeVectorNode(tier, PENULT_DEPTH_INDEX, 0, 'SANCTUARY', 'CITY_STREETS'),
        makeVectorNode(tier, PENULT_DEPTH_INDEX, 1, 'NARRATIVE_EVENT', 'CITY_STREETS'),
      ];
      continue;
    }

    if (depth === BOSS_DEPTH_INDEX) {
      matrix[BOSS_DEPTH_INDEX] = [
        makeVectorNode(tier, BOSS_DEPTH_INDEX, 0, 'COMBAT', 'CITY_STREETS', true),
      ];
      continue;
    }

    if (depth === MANDATORY_SANCTUARY_DEPTH) {
      const count = randomBranchCount();
      const sanctuarySlot = Math.floor(Math.random() * count);
      matrix[depth] = buildFlexibleCluster(tier, depth, count, sanctuarySlot, 'CITY_STREETS');
      continue;
    }

    if (MIDDLE_SANCTUARY_CANDIDATES.includes(depth as (typeof MIDDLE_SANCTUARY_CANDIDATES)[number])) {
      const count = randomBranchCount();
      const sanctuarySlot = depth === middleSanctuaryDepth ? Math.floor(Math.random() * count) : -1;
      matrix[depth] = buildFlexibleCluster(
        tier,
        depth,
        count,
        sanctuarySlot,
        'CITY_STREETS',
      );
      continue;
    }

    const count = randomBranchCount();
    matrix[depth] = buildFlexibleCluster(tier, depth, count, -1, 'CITY_STREETS');
  }

  const earlySanctuarySpawned = matrix.some(
    (cluster, depth) =>
      depth !== PENULT_DEPTH_INDEX &&
      depth !== BOSS_DEPTH_INDEX &&
      cluster.some((node) => node.encounterType === 'SANCTUARY'),
  );

  return { activeTierVectors: matrix, earlySanctuarySpawned };
}

export function createPlaceholderTierPath(): IncursionNode[] {
  return Array.from({ length: INCURSION_DEPTH_COUNT }, (_, depthIndex) => ({
    id: `pending-${depthIndex}`,
    depthIndex,
    index: depthIndex,
    encounterType: 'COMBAT' as IncursionEncounterType,
    type: 'STANDARD_COMBAT' as RunNodeType,
    biome: 'CITY_STREETS' as IncursionBiome,
    label: `DEPTH ${depthIndex + 1} // AWAITING VECTOR LOCK`,
    isCompleted: false,
  }));
}

export function finalizeClusterForScan(
  cluster: IncursionNode[],
  depthIndex: number,
  tierNodes: IncursionNode[],
  _tier: number,
): IncursionNode[] {
  const priorBiome =
    depthIndex > 0 ? tierNodes[depthIndex - 1]?.biome ?? 'CITY_STREETS' : 'CITY_STREETS';

  return cluster.map((node, optionIndex) => {
    const biome = node.encounterType === 'SANCTUARY'
      ? (priorBiome ?? 'CITY_STREETS')
      : resolveBiomeForOption(depthIndex, optionIndex, priorBiome);

    const encounterType =
      depthIndex === BOSS_DEPTH_INDEX ? 'COMBAT' : node.encounterType;

    const type = encounterToRunNodeType(encounterType, depthIndex);

    return {
      ...node,
      depthIndex,
      index: depthIndex,
      encounterType,
      biome,
      type,
      isPreDiscovered: depthIndex === BOSS_DEPTH_INDEX ? true : node.isPreDiscovered,
    };
  });
}

function incursionEncounterToRadarType(encounterType: IncursionEncounterType): EncounterType {
  switch (encounterType) {
    case 'SANCTUARY':
      return 'REST';
    case 'NARRATIVE_EVENT':
      return 'SKILL_CHECK';
    default:
      return 'COMBAT';
  }
}

export function generateTierNodeScanVectors(
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

export function getTierScale(tier: number): number {
  return 1 + (tier - 1) * 0.25;
}

const DEFAULT_BOSS_PHASES = [
  {
    phaseNumber: 1,
    phaseName: 'Standard Operations',
    triggerHpThreshold: 51,
    intentModifier: 'Low-tier conduit strikes',
  },
  {
    phaseNumber: 2,
    phaseName: 'Rift Overdrive',
    triggerHpThreshold: 50,
    intentModifier: 'Catastrophic overdrive discharge',
  },
];

export function createBossProfileForTier(tier: number): import('../types/game').BossRuntimeProfile {
  const scale = getTierScale(tier);
  const profiles: Record<number, { name: string; maxHp: number }> = {
    1: { name: 'THE COLD-ROOM CONDUIT', maxHp: 100 },
    2: { name: 'RIVAL COMMANDER — VOID LANCER', maxHp: Math.floor(150 * scale) },
    3: { name: 'RIFT ENTITY PRIME', maxHp: 250 },
  };
  const def = profiles[tier] ?? profiles[1];
  return {
    name: def.name,
    maxHp: def.maxHp,
    currentHp: def.maxHp,
    currentPhase: 1,
    phases: DEFAULT_BOSS_PHASES,
    tier,
  };
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
  depthIndex: number,
): string {
  if (encounterType === 'COMBAT' && depthIndex === BOSS_DEPTH_INDEX) {
    return 'Boss Combat';
  }
  return ENCOUNTER_DISPLAY_LABEL[encounterType];
}
