import type { IncursionEncounterType, IncursionNode, RunNodeType } from '../types/game';
import type { NodeSectorMeta, SpectralThreatBand } from '../types/sector';
import {
  RESONANCE_DELTA_HIGH,
  RESONANCE_DELTA_STANDARD,
  GREED_ZONE_YIELD_MULTIPLIER,
} from '../types/sector';
import { rollProbableAffinity } from './combatEnvironmentEngine';
import type { DistrictId } from './districtPacing';
import { isDistrictGateDepth, localLevelFromDepth } from './districtPacing';
import type { RunSegmentState } from './encounterGenerator';
import { isAlphaDuelLevel, isBreathingRoomLevel } from './encounterGenerator';
import type { BreathingRoomKind } from './encounterGenerator';

export type MatrixSpawnKind =
  | 'STANDARD_COMBAT'
  | 'ELITE_COMBAT'
  | 'NARRATIVE_EVENT'
  | 'HARD_NARRATIVE'
  | 'BLACK_MARKET'
  | 'FACTION_VAULT_HIGH'
  | 'VEIL_BLEED_BOON'
  | 'BOSS_COMBAT';

/** Ley-Scar cost when engaging a guaranteed Veil Bleed vector. */
export const VEIL_BLEED_HP_COST_PCT = 30;

interface LevelMatrixSpec {
  minChoices: number;
  maxChoices: number;
  guaranteed: MatrixSpawnKind[];
  pool: MatrixSpawnKind[];
}

const LEVEL_MATRIX: Record<number, LevelMatrixSpec> = {
  /** Act I — The Drop */
  1: { minChoices: 1, maxChoices: 1, guaranteed: ['STANDARD_COMBAT'], pool: [] },
  2: { minChoices: 2, maxChoices: 2, guaranteed: [], pool: ['STANDARD_COMBAT', 'NARRATIVE_EVENT'] },
  3: { minChoices: 2, maxChoices: 2, guaranteed: [], pool: ['STANDARD_COMBAT', 'NARRATIVE_EVENT'] },
  4: { minChoices: 2, maxChoices: 2, guaranteed: [], pool: ['STANDARD_COMBAT', 'NARRATIVE_EVENT'] },
  5: {
    minChoices: 2,
    maxChoices: 3,
    guaranteed: ['BLACK_MARKET'],
    pool: ['STANDARD_COMBAT', 'FACTION_VAULT_HIGH'],
  },
  /** Act II — The Bleed */
  6: {
    minChoices: 2,
    maxChoices: 3,
    guaranteed: ['VEIL_BLEED_BOON'],
    pool: ['STANDARD_COMBAT', 'NARRATIVE_EVENT'],
  },
  7: {
    minChoices: 3,
    maxChoices: 4,
    guaranteed: [],
    pool: ['STANDARD_COMBAT', 'ELITE_COMBAT', 'NARRATIVE_EVENT', 'FACTION_VAULT_HIGH'],
  },
  8: {
    minChoices: 2,
    maxChoices: 3,
    guaranteed: [],
    pool: ['STANDARD_COMBAT', 'ELITE_COMBAT', 'NARRATIVE_EVENT'],
  },
  9: {
    minChoices: 2,
    maxChoices: 3,
    guaranteed: [],
    pool: ['ELITE_COMBAT', 'FACTION_VAULT_HIGH', 'NARRATIVE_EVENT'],
  },
  10: {
    minChoices: 2,
    maxChoices: 2,
    guaranteed: ['BLACK_MARKET', 'ELITE_COMBAT'],
    pool: [],
  },
  /** Act III — The Squeeze */
  11: {
    minChoices: 2,
    maxChoices: 3,
    guaranteed: ['VEIL_BLEED_BOON'],
    pool: ['ELITE_COMBAT', 'HARD_NARRATIVE'],
  },
  12: {
    minChoices: 2,
    maxChoices: 3,
    guaranteed: [],
    pool: ['ELITE_COMBAT', 'STANDARD_COMBAT', 'FACTION_VAULT_HIGH'],
  },
  13: {
    minChoices: 2,
    maxChoices: 2,
    guaranteed: [],
    pool: ['ELITE_COMBAT', 'HARD_NARRATIVE'],
  },
  14: {
    minChoices: 2,
    maxChoices: 2,
    guaranteed: ['BLACK_MARKET', 'ELITE_COMBAT'],
    pool: [],
  },
  15: {
    minChoices: 1,
    maxChoices: 1,
    guaranteed: ['BOSS_COMBAT'],
    pool: [],
  },
};

const VECTOR_DESIGNATIONS = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON', 'ZETA'] as const;

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed: string): () => number {
  let state = hashSeed(seed);
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}

function isCombatKind(kind: MatrixSpawnKind): boolean {
  return kind === 'STANDARD_COMBAT' || kind === 'ELITE_COMBAT' || kind === 'BOSS_COMBAT';
}

export function clusterOffersCombat(nodes: readonly IncursionNode[]): boolean {
  return nodes.some(
    (node) => node.type === 'STANDARD_COMBAT'
      || node.type === 'ELITE_COMBAT'
      || node.type === 'BOSS_COMBAT',
  );
}

function spawnKindToTypes(kind: MatrixSpawnKind): {
  encounterType: IncursionEncounterType;
  type: RunNodeType;
  label: string;
  narrativeTags?: readonly string[];
  isHardNarrative?: boolean;
  combatTier: 'STANDARD' | 'ELITE';
} {
  switch (kind) {
    case 'STANDARD_COMBAT':
      return {
        encounterType: 'COMBAT',
        type: 'STANDARD_COMBAT',
        label: 'VECTOR // STANDARD HOSTILE MANIFEST',
        combatTier: 'STANDARD',
      };
    case 'ELITE_COMBAT':
      return {
        encounterType: 'COMBAT',
        type: 'ELITE_COMBAT',
        label: 'VECTOR // ELITE HEAT SIGNATURE',
        combatTier: 'ELITE',
      };
    case 'NARRATIVE_EVENT':
      return {
        encounterType: 'NARRATIVE_EVENT',
        type: 'NARRATIVE_EVENT',
        label: 'VECTOR // DATA SPIKE / NARRATIVE BAND',
        combatTier: 'STANDARD',
      };
    case 'HARD_NARRATIVE':
      return {
        encounterType: 'NARRATIVE_EVENT',
        type: 'NARRATIVE_EVENT',
        label: 'VECTOR // HIGH-STAKES NARRATIVE LOCK',
        combatTier: 'STANDARD',
        isHardNarrative: true,
        narrativeTags: ['vault', 'tech'],
      };
    case 'BLACK_MARKET':
      return {
        encounterType: 'BLACK_MARKET',
        type: 'BLACK_MARKET',
        label: 'VECTOR // BLACK MARKET CONDUIT',
        combatTier: 'STANDARD',
      };
    case 'VEIL_BLEED_BOON':
      return {
        encounterType: 'RESOURCE_HARVEST',
        type: 'VEIL_BLEED_BOON',
        label: 'VECTOR // VEIL BLEED (BOON)',
        combatTier: 'STANDARD',
      };
    case 'FACTION_VAULT_HIGH':
      return {
        encounterType: 'NARRATIVE_EVENT',
        type: 'NARRATIVE_EVENT',
        label: 'VECTOR // FACTION VAULT (HIGH-YIELD)',
        combatTier: 'STANDARD',
        narrativeTags: ['vault', 'tech'],
      };
    case 'BOSS_COMBAT':
      return {
        encounterType: 'COMBAT',
        type: 'BOSS_COMBAT',
        label: 'VECTOR // GATEKEEPER MANIFEST',
        combatTier: 'ELITE',
      };
    default:
      return {
        encounterType: 'COMBAT',
        type: 'STANDARD_COMBAT',
        label: 'VECTOR // STANDARD HOSTILE MANIFEST',
        combatTier: 'STANDARD',
      };
  }
}

function spectralForBand(nodeId: string, band: SpectralThreatBand): NodeSectorMeta['spectral'] {
  const seed = hashSeed(nodeId);
  const profiles: Record<SpectralThreatBand, NodeSectorMeta['spectral']> = {
    LOW: {
      radialFrequency: 'Stable Void Bleed // Low Occult Noise',
      visualSpectrum: 'Ash Fall Static // Soft Geometry',
      occultIndex: 'Dormant Crystal Lattice',
      threatProfile: 'LOW // RECOVERY BAND POSSIBLE',
      threatBand: 'LOW',
    },
    MODERATE: {
      radialFrequency: 'Unstable Void Bleed Detected',
      visualSpectrum: 'Shattered Reality Geometry // Flicker',
      occultIndex: 'Mixed Null Crystal Scatter',
      threatProfile: 'MODERATE // DATA OR COMMERCE BAND',
      threatBand: 'MODERATE',
    },
    ELEVATED: {
      radialFrequency: 'Volatile Heat Bloom Detected',
      visualSpectrum: 'Fractured Corridor // Red Shift',
      occultIndex: 'High-Density Anomaly Core',
      threatProfile: 'ELEVATED // HOSTILE OR FRAGMENT RISK',
      threatBand: 'ELEVATED',
    },
    CRITICAL: {
      radialFrequency: 'Prime Anomaly Frequency Lock',
      visualSpectrum: 'Void Chasm Collapse // Black Sun Static',
      occultIndex: 'CRITICAL Null Crystal Concentration',
      threatProfile: 'CRITICAL // UNKNOWN ANOMALY COLD SPOT',
      threatBand: 'CRITICAL',
    },
    UNKNOWN: {
      radialFrequency: 'Unclassified Band // Phase Noise',
      visualSpectrum: 'Indeterminate Geometry',
      occultIndex: 'Unreadable Occult Index',
      threatProfile: 'UNKNOWN // BREACH ADVISORY',
      threatBand: 'UNKNOWN',
    },
  };
  const base = profiles[band];
  if (seed % 3 === 1) {
    return { ...base, occultIndex: 'Unstable Frequency // Faction Broadcast Detected' };
  }
  return base;
}

function buildMatrixSectorMeta(
  nodeId: string,
  encounterType: IncursionEncounterType,
  type: RunNodeType,
  graphDepth: number,
  sectorTier: number,
  combatTier: 'STANDARD' | 'ELITE',
): NodeSectorMeta {
  const isElite = type === 'ELITE_COMBAT' || type === 'BOSS_COMBAT';
  const band: SpectralThreatBand = isElite ? 'ELEVATED' : 'MODERATE';
  const resonanceDelta = isElite ? RESONANCE_DELTA_HIGH : RESONANCE_DELTA_STANDARD;
  const tierYield = 1 + (sectorTier - 1) * 0.15;
  const depthYield = graphDepth >= 8 ? GREED_ZONE_YIELD_MULTIPLIER : 1;
  const isCombatNode = encounterType === 'COMBAT' || type === 'ELITE_COMBAT' || type === 'BOSS_COMBAT';

  return {
    spectral: spectralForBand(nodeId, band),
    resonanceDelta: Math.round(resonanceDelta * tierYield),
    isFocused: false,
    yieldMultiplier: tierYield * depthYield,
    creditBonus: type === 'ELITE_COMBAT' ? 100 : 0,
    combatTier,
    probableAffinity: isCombatNode
      ? rollProbableAffinity(encounterType, combatTier, nodeId)
      : undefined,
  };
}

function makeMatrixNode(
  kind: MatrixSpawnKind,
  graphDepth: number,
  district: DistrictId,
  localLevel: number,
  slotIndex: number,
  stepIndex: number,
  sectorTier: number,
  seed: string,
): IncursionNode {
  const mapped = spawnKindToTypes(kind);
  const nodeId = `matrix-d${district}-l${localLevel}-s${slotIndex}-${seed}`;
  const designation = VECTOR_DESIGNATIONS[slotIndex % VECTOR_DESIGNATIONS.length];

  return {
    id: nodeId,
    encounterIndex: stepIndex,
    index: stepIndex,
    encounterType: mapped.encounterType,
    type: mapped.type,
    label: mapped.label.replace('VECTOR', `VECTOR ${designation}`),
    isCompleted: false,
    isAnomalyNest: mapped.type === 'BOSS_COMBAT',
    isPreDiscovered: mapped.type === 'BOSS_COMBAT',
    narrativeTags: mapped.narrativeTags,
    isHardNarrative: mapped.isHardNarrative,
    sectorMeta: buildMatrixSectorMeta(
      nodeId,
      mapped.encounterType,
      mapped.type,
      graphDepth,
      sectorTier,
      mapped.combatTier,
    ),
  };
}

function pickPoolSlots(
  pool: MatrixSpawnKind[],
  count: number,
  rand: () => number,
  forceCombat: boolean,
): MatrixSpawnKind[] {
  if (count <= 0) return [];
  const picks: MatrixSpawnKind[] = [];
  for (let i = 0; i < count; i += 1) {
    picks.push(pool[Math.floor(rand() * pool.length)] ?? pool[0]);
  }
  if (forceCombat && !picks.some(isCombatKind) && pool.some(isCombatKind)) {
    const combatOptions = pool.filter(isCombatKind);
    picks[picks.length - 1] = combatOptions[Math.floor(rand() * combatOptions.length)];
  }
  return picks;
}

export interface MaterializeLevelClusterParams {
  graphDepth: number;
  district: DistrictId;
  nodesCleared: number;
  sectorTier: number;
  lastLevelOfferedCombat: boolean;
  seed?: string;
  runSegment?: RunSegmentState | null;
}

function breathingRoomToMatrixKind(kind: BreathingRoomKind): MatrixSpawnKind {
  if (kind === 'BLACK_MARKET') return 'BLACK_MARKET';
  if (kind === 'VEIL_BLEED_BOON') return 'VEIL_BLEED_BOON';
  return 'FACTION_VAULT_HIGH';
}

/** Roll forward-vector options for the upcoming depth using the 15-level golden rules matrix. */
export function materializeLevelCluster(params: MaterializeLevelClusterParams): IncursionNode[] {
  const {
    graphDepth,
    district,
    nodesCleared,
    sectorTier,
    lastLevelOfferedCombat,
    seed = `matrix:${graphDepth}:${district}`,
    runSegment = null,
  } = params;

  const localLevel = localLevelFromDepth(graphDepth);
  const spec = LEVEL_MATRIX[localLevel] ?? LEVEL_MATRIX[3];
  const rand = seededRandom(seed);
  const stepIndex = nodesCleared;

  if (runSegment && isBreathingRoomLevel(runSegment, localLevel)) {
    const roll = rand();
    const breathingKind: BreathingRoomKind =
      roll < 0.4 ? 'BLACK_MARKET' : roll < 0.8 ? 'VEIL_BLEED_BOON' : 'RESOURCE_HARVEST';
    const kind = breathingRoomToMatrixKind(breathingKind);
    return [makeMatrixNode(kind, graphDepth, district, localLevel, 0, stepIndex, sectorTier, seed)];
  }

  if (runSegment && isAlphaDuelLevel(runSegment, localLevel)) {
    return [
      makeMatrixNode('ELITE_COMBAT', graphDepth, district, localLevel, 0, stepIndex, sectorTier, seed),
    ];
  }

  const choiceCount = spec.minChoices === spec.maxChoices
    ? spec.minChoices
    : spec.minChoices + Math.floor(rand() * (spec.maxChoices - spec.minChoices + 1));

  const forceCombat = !lastLevelOfferedCombat;
  const guaranteed = [...spec.guaranteed];
  const fillCount = Math.max(0, choiceCount - guaranteed.length);
  const poolPicks = pickPoolSlots(spec.pool, fillCount, rand, forceCombat);

  let kinds = [...guaranteed, ...poolPicks].slice(0, choiceCount);

  if (forceCombat && !kinds.some(isCombatKind)) {
    kinds = [...kinds.slice(0, -1), 'STANDARD_COMBAT'];
  }

  if (isDistrictGateDepth(graphDepth)) {
    return kinds
      .filter((k) => k === 'BOSS_COMBAT')
      .map((kind, i) => makeMatrixNode(kind, graphDepth, district, localLevel, i, stepIndex, sectorTier, seed));
  }

  return kinds.map((kind, i) =>
    makeMatrixNode(kind, graphDepth, district, localLevel, i, stepIndex, sectorTier, seed),
  );
}

const DEPTH1_TEST_KINDS: MatrixSpawnKind[] = [
  'STANDARD_COMBAT',
];

function makeTestMatrixNode(
  kind: MatrixSpawnKind,
  graphDepth: number,
  district: DistrictId,
  localLevel: number,
  slotIndex: number,
  stepIndex: number,
  sectorTier: number,
): IncursionNode {
  const mapped = spawnKindToTypes(kind);
  const nodeId = `test-d1-${kind.toLowerCase()}-s${slotIndex}`;
  const designation = VECTOR_DESIGNATIONS[slotIndex % VECTOR_DESIGNATIONS.length];

  return {
    id: nodeId,
    encounterIndex: stepIndex,
    index: stepIndex,
    encounterType: mapped.encounterType,
    type: mapped.type,
    label: mapped.label.replace('VECTOR', `VECTOR ${designation}`),
    isCompleted: false,
    isAnomalyNest: false,
    isPreDiscovered: false,
    narrativeTags: mapped.narrativeTags,
    isHardNarrative: mapped.isHardNarrative,
    sectorMeta: buildMatrixSectorMeta(
      nodeId,
      mapped.encounterType,
      mapped.type,
      graphDepth,
      sectorTier,
      mapped.combatTier,
    ),
  };
}

/** Depth 1 opener — single combat vector on the first scanner screen. */
export function buildDepth1TestScannerCluster(params: MaterializeLevelClusterParams): IncursionNode[] {
  const { graphDepth, district, nodesCleared: stepIndex, sectorTier } = params;
  const localLevel = localLevelFromDepth(graphDepth);
  return DEPTH1_TEST_KINDS.map((kind, i) =>
    makeTestMatrixNode(kind, graphDepth, district, localLevel, i, stepIndex, sectorTier),
  );
}

export function isDepth1TestScannerCluster(cluster: readonly IncursionNode[]): boolean {
  return cluster.length === DEPTH1_TEST_KINDS.length
    && cluster.every((node) => node.id.startsWith('test-d1-'));
}

export function requiresVeilBleedBoon(localLevel: number): boolean {
  return localLevel === 6 || localLevel === 11;
}

export function maxVectorsForLocalLevel(localLevel: number): number {
  return LEVEL_MATRIX[localLevel]?.maxChoices ?? 3;
}
