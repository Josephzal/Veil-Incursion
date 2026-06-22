import {
  ActiveIncursionState,
  IncursionEncounterType,
  IncursionNode,
  RunNodeType,
} from '../types/game';
import { getMacroBiomeDisplayLabel, resolveDisplayedMacroBiome } from './macroBiomeEngine';
import type { MacroBiomeFamily } from '../types/narrativeProcedural';
import { formatSpectralBlock } from './sectorGraphEngine';
import { ELITE_MODIFIER_LABELS } from './eliteModifierEngine';
import { EncounterType, RadarDot, SectorDefinition } from '../types/run';
import { INCURSION_ENCOUNTER_COUNT } from '../types/run';
import {
  createRadarDotFromPolar,
  layoutRadarDotsOnScanner,
} from './scannerNodeLayout';
import { INITIAL_SECTOR_POOL } from './regions';
import { createDistrictGateBossProfile } from './districtBosses';
import { getDepthScale } from './descentScaling';

export { getDepthScale } from './descentScaling';

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

export const ENCOUNTER_DISPLAY_LABEL: Record<IncursionEncounterType, string> = {
  COMBAT: 'Combat',
  ANOMALY: 'Anomaly',
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
  if (encounterType === 'ANOMALY') return 'ANOMALY';
  if (encounterType === 'NARRATIVE_EVENT') return 'NARRATIVE_EVENT';
  if (encounterType === 'BLACK_MARKET') return 'BLACK_MARKET';
  return encounterIndex === BOSS_ENCOUNTER_INDEX ? 'BOSS_COMBAT' : 'STANDARD_COMBAT';
}

export function isCombatNodeType(type: RunNodeType): boolean {
  return type === 'STANDARD_COMBAT' || type === 'ELITE_COMBAT' || type === 'BOSS_COMBAT';
}

function rollFlexibleEncounter(): IncursionEncounterType {
  return Math.random() < 0.45 ? 'ANOMALY' : 'COMBAT';
}

function makeVectorNode(
  depth: number,
  encounterIndex: number,
  optionIndex: number,
  encounterType: IncursionEncounterType,
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
    type,
    label: `${prefix} // ${masked.label}`,
    isCompleted: false,
    isPreDiscovered,
  };
}

/** Encounter 0 — combat, narrative, and black market vectors. */
function buildFirstScanCluster(depth: number): IncursionNode[] {
  return [
    makeVectorNode(depth, 0, 0, 'COMBAT'),
    makeVectorNode(depth, 0, 1, 'ANOMALY'),
    makeVectorNode(depth, 0, 2, 'BLACK_MARKET'),
  ];
}

function buildFlexibleCluster(
  depth: number,
  encounterIndex: number,
  count: number,
  forcedSanctuarySlot: number,
): IncursionNode[] {
  const cluster: IncursionNode[] = [];

  for (let i = 0; i < count; i += 1) {
    if (i === forcedSanctuarySlot) {
      cluster.push(makeVectorNode(depth, encounterIndex, i, 'SANCTUARY'));
    } else {
      cluster.push(makeVectorNode(depth, encounterIndex, i, rollFlexibleEncounter()));
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
        makeVectorNode(depth, 2, 0, 'COMBAT'),
        makeVectorNode(depth, 2, 1, 'BLACK_MARKET'),
        makeVectorNode(depth, 2, 2, 'ANOMALY'),
      ];
      continue;
    }

    if (encounter === PENULT_ENCOUNTER_INDEX) {
      matrix[PENULT_ENCOUNTER_INDEX] = [
        makeVectorNode(depth, PENULT_ENCOUNTER_INDEX, 0, 'SANCTUARY'),
        makeVectorNode(depth, PENULT_ENCOUNTER_INDEX, 1, 'ANOMALY'),
      ];
      continue;
    }

    if (encounter === BOSS_ENCOUNTER_INDEX) {
      matrix[BOSS_ENCOUNTER_INDEX] = [
        makeVectorNode(depth, BOSS_ENCOUNTER_INDEX, 0, 'COMBAT', true),
      ];
      continue;
    }

    if (encounter === MANDATORY_SANCTUARY_ENCOUNTER) {
      const count = randomBranchCount();
      const sanctuarySlot = Math.floor(Math.random() * count);
      matrix[encounter] = buildFlexibleCluster(depth, encounter, count, sanctuarySlot);
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
      );
      continue;
    }

    const count = randomBranchCount();
    matrix[encounter] = buildFlexibleCluster(depth, encounter, count, -1);
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
    label: `ENCOUNTER ${encounterIndex + 1} // AWAITING VECTOR LOCK`,
    isCompleted: false,
  }));
}

export function finalizeClusterForScan(
  cluster: IncursionNode[],
  encounterIndex: number,
  _encounterPath: IncursionNode[],
  _depth: number,
): IncursionNode[] {
  return cluster.map((node) => {
    const encounterType =
      encounterIndex === BOSS_ENCOUNTER_INDEX ? 'COMBAT' : node.encounterType;

    const type = encounterToRunNodeType(encounterType, encounterIndex);

    return {
      ...node,
      encounterIndex,
      index: encounterIndex,
      encounterType,
      type,
      isPreDiscovered: encounterIndex === BOSS_ENCOUNTER_INDEX ? true : node.isPreDiscovered,
    };
  });
}

function incursionEncounterToRadarType(encounterType: IncursionEncounterType): EncounterType {
  switch (encounterType) {
    case 'SANCTUARY':
      return 'REST';
    case 'ANOMALY':
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

export { getMacroBiomeDisplayLabel } from './macroBiomeEngine';

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

/** Scanner dock readout — macro biome, vector designation, and node type only. */
export function formatScannerNodeIntel(
  node: IncursionNode,
  macroFamily: MacroBiomeFamily | null | undefined,
  optionIndex = 0,
): string[] {
  const vector = resolveVectorLabel(node, optionIndex);
  const nodeType = node.type.replace(/_/g, ' ');
  const displayBiome = resolveDisplayedMacroBiome(node, macroFamily);
  return [
    `> MACRO BIOME: ${getMacroBiomeDisplayLabel(displayBiome).toUpperCase()}`,
    `> VECTOR: ${vector}`,
    `> NODE TYPE: ${nodeType.toUpperCase()}`,
  ];
}

/** Modifier status lines for the scanner dock. */
export function formatScannerNodeStatus(
  _node: IncursionNode,
  incursion: Pick<ActiveIncursionState, 'environmentalModifiers'>,
): string[] {
  const lines: string[] = [];

  const eliteModifier = incursion.environmentalModifiers?.eliteModifier;
  if (eliteModifier) {
    lines.push(`> ELITE MODIFIER: ${ELITE_MODIFIER_LABELS[eliteModifier].toUpperCase()}`);
  }

  return lines;
}

/** Combat HUD readout — macro biome / encounter context (no hostile intel). */
export function formatCombatEncounterIntel(
  node: IncursionNode | null,
  incursion: Pick<
    ActiveIncursionState,
    'sectorTier' | 'nodesCleared' | 'environmentalModifiers' | 'defendRiftActive' | 'currentMacroBiomeFamily'
  >,
  optionIndex = 0,
): string[] {
  if (!node) {
    return ['> ENCOUNTER DATA // AWAITING VECTOR LOCK'];
  }

  const lines: string[] = [
    `> MACRO BIOME: ${getMacroBiomeDisplayLabel(incursion.currentMacroBiomeFamily).toUpperCase()}`,
    `> VECTOR: ${resolveVectorLabel(node, optionIndex)}`,
    `> NODE TYPE: ${node.type.replace(/_/g, ' ').toUpperCase()}`,
    `> ENCOUNTER: ${getEncounterDisplayLabel(node.encounterType, node.encounterIndex).toUpperCase()}`,
  ];

  if (node.sectorMeta) {
    lines.push(...formatSpectralBlock(node.sectorMeta, true));
    if (node.sectorMeta.yieldMultiplier > 1) {
      lines.push(`> YIELD MULTIPLIER: x${node.sectorMeta.yieldMultiplier.toFixed(2)}`);
    }
    if (node.sectorMeta.combatTier === 'ELITE') {
      lines.push('> COMBAT TIER: ELITE');
    }
    if ((node.sectorMeta.creditBonus ?? 0) > 0) {
      lines.push(`> CREDIT BONUS: +${node.sectorMeta.creditBonus}`);
    }
  }

  const eliteModifier = incursion.environmentalModifiers?.eliteModifier;
  if (eliteModifier) {
    lines.push(`> ELITE MODIFIER: ${ELITE_MODIFIER_LABELS[eliteModifier].toUpperCase()}`);
  }

  if (incursion.defendRiftActive) {
    lines.push('> OBJECTIVE: EMERGENCY RECALL // ELITE INTERCEPT');
  } else if (node.type === 'BOSS_COMBAT' || node.isAnomalyNest) {
    lines.push('> OBJECTIVE: REGION-PRIME ANOMALY');
  }

  lines.push(`> SECTOR T${incursion.sectorTier} // NODE ${incursion.nodesCleared + 1}`);

  return lines;
}
